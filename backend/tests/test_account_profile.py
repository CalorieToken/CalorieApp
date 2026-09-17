"""Private profile persistence, account isolation and authenticated widget reads."""
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

import pytest
from sqlmodel import Session, create_engine

import app.database as database
import app.main as main
from app.models import AuthSessionDB, CalorieAppUserDB, ExternalIdentityDB
from app.schema_migrations import upgrade_database, assert_database_at_head

HEADERS = {'X-CalorieApp-Request': 'account-profile'}

def save(client, value, user_id=None, headers=HEADERS):
    user_id = user_id or client.get('/api/identity/me').json()['user_id']
    return client.post('/api/identity/profile', headers=headers, json={'user_id': user_id, 'nickname': value})

def session_for(client, user_id):
    token = token_urlsafe(48)
    now = datetime.now(UTC)
    with Session(database.engine) as db:
        db.add(AuthSessionDB(calorieapp_user_id=user_id, session_token_hash=hashlib.sha256(token.encode()).hexdigest(), created_at=now, last_seen_at=now, expires_at=now+timedelta(hours=1)))
        db.commit()
    client.cookies.clear()
    client.cookies.set('calorieapp_session', token)


def test_nickname_survives_logout_and_fresh_session(authenticated_client):
    c = authenticated_client
    uid = c.get('/api/identity/me').json()['user_id']
    response = save(c, '  Piet  ')
    assert response.status_code == 200
    assert response.json()['nickname'] == 'Piet'
    assert response.headers['cache-control'] == 'no-store'
    assert c.post('/api/identity/logout').status_code == 200
    assert c.get('/api/identity/me').status_code == 401
    session_for(c, uid)
    assert c.get('/api/identity/me').json()['nickname'] == 'Piet'
    assert c.get('/api/identity/export').json()['account']['nickname'] == 'Piet'
    assert save(c, None).json()['nickname'] is None
    session_for(c, uid)
    assert c.get('/api/identity/me').json()['nickname'] is None


def test_account_switch_cannot_read_or_overwrite_previous_nickname(authenticated_client):
    c=authenticated_client
    original=c.get('/api/identity/me').json()['user_id']
    assert save(c,'Piet').status_code == 200
    with Session(database.engine) as db:
        other=CalorieAppUserDB();db.add(other);db.commit();db.refresh(other);other_id=other.id
    session_for(c,other_id)
    assert c.get('/api/identity/me').json()['nickname'] is None
    assert save(c,'Changed',original).status_code == 409
    assert save(c,'Another').status_code == 200
    session_for(c,original)
    assert c.get('/api/identity/me').json()['nickname'] == 'Piet'


@pytest.mark.parametrize('value',['A','a'*33,'<script>','ok\x00','ab\x85','ab\u202e','ab\u2067',123,{},[]])
def test_invalid_nickname_never_replaces_saved_value(authenticated_client,value):
    assert save(authenticated_client,'Piet').status_code == 200
    assert save(authenticated_client,value).status_code == 422
    assert authenticated_client.get('/api/identity/me').json()['nickname']=='Piet'


def test_unicode_normalization_and_csrf_guards(authenticated_client):
    assert save(authenticated_client,'Pe\u0301ter').json()['nickname']=='Péter'
    assert save(authenticated_client,'Other',headers={}).status_code==403
    assert save(authenticated_client,'Other',headers={**HEADERS,'Origin':'https://example.invalid'}).status_code==403
    assert authenticated_client.post('/api/identity/profile',content='nickname=Other',headers={'Content-Type':'application/x-www-form-urlencoded'}).status_code==422


def test_unauthenticated_profile_write_rejected(client):
    assert client.post('/api/identity/profile',headers=HEADERS,json={'user_id':'someone','nickname':'Piet'}).status_code==401


def bridge_headers(subject,secret,state=None):
    timestamp=str(int(datetime.now(UTC).timestamp()));nonce=token_urlsafe(40)
    data={'version':'v1','client_id':main._CALORIEAPP_CLIENT_ID,'timestamp':timestamp,'nonce':nonce,'state':state or 'account-profile-v1:'+subject}
    signature=hmac.new(secret.encode(),json.dumps(data,separators=(',',':'),ensure_ascii=False).encode(),hashlib.sha256).hexdigest()
    return {'X-CalorieApp-Client-Id':main._CALORIEAPP_CLIENT_ID,'X-CalorieApp-Timestamp':timestamp,'X-CalorieApp-Nonce':nonce,'X-CalorieApp-Signature':signature}


def test_widget_read_is_signed_scoped_and_replay_protected(authenticated_client,monkeypatch):
    c=authenticated_client;secret='synthetic-profile-secret';subject='wp:calorietoken.net:123'
    monkeypatch.setattr(main,'_WORDPRESS_BRIDGE_SECRET',secret)
    uid=c.get('/api/identity/me').json()['user_id'];save(c,'Piet')
    with Session(database.engine) as db:
        db.add(ExternalIdentityDB(calorieapp_user_id=uid,provider='wordpress_xumm',external_subject=subject));db.commit()
    url='/api/identity/profile/wordpress';body={'external_subject':subject}
    assert c.post(url,json=body).status_code==403
    assert c.post(url,json=body,headers=bridge_headers(subject,secret,state=subject)).status_code==403
    headers=bridge_headers(subject,secret)
    assert c.post(url,json={'external_subject':'wp:calorietoken.net:124'},headers=headers).status_code==403
    response=c.post(url,json=body,headers=headers)
    assert response.status_code==200 and response.json()=={'nickname':'Piet'}
    assert response.headers['cache-control']=='no-store'
    assert c.post(url,json=body,headers=headers).status_code==403
    assert c.post(url,json={'external_subject':'wp:calorietoken.net:124'},headers=bridge_headers('wp:calorietoken.net:124',secret)).json()=={'nickname':None}


def test_profile_persists_after_database_reopen(tmp_path):
    url=f'sqlite:///{tmp_path}/profile.db'
    engine=create_engine(url)
    upgrade_database(engine)
    with Session(engine) as db:
        user=CalorieAppUserDB(nickname='Piet');db.add(user);db.commit();uid=user.id
    engine.dispose()
    engine=create_engine(url)
    assert_database_at_head(engine)
    with Session(engine) as db: assert db.get(CalorieAppUserDB,uid).nickname=='Piet'
    engine.dispose()


def test_nickname_migration_preserves_an_existing_account(tmp_path, monkeypatch):
    import app.schema_migrations.runner as runner
    engine=create_engine(f'sqlite:///{tmp_path}/upgrade.db')
    migrations=runner.MIGRATIONS
    monkeypatch.setattr(runner,'MIGRATIONS',migrations[:-1])
    monkeypatch.setattr(runner,'SCHEMA_HEAD','20260902_0016')
    runner.upgrade_database(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO calorieappuser(id,created_at,updated_at,status,last_authenticated_activity_at) VALUES ('existing','2026-09-17','2026-09-17','active','2026-09-17')")
    monkeypatch.setattr(runner,'MIGRATIONS',migrations)
    monkeypatch.setattr(runner,'SCHEMA_HEAD','20260917_0017')
    runner.upgrade_database(engine);runner.assert_database_at_head(engine)
    with Session(engine) as db:
        user=db.get(CalorieAppUserDB,'existing')
        assert user.status=='active' and user.nickname is None
    engine.dispose()
