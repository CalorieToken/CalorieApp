"""Actual production UI; every account request uses synthetic data only."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'ux-check-evidence/account-profile-browser'
OUT.mkdir(parents=True,exist_ok=True)
COPY=json.loads((ROOT/'frontend/config/account-profile-copy.json').read_text())
AUTH=json.loads((ROOT/'frontend/config/auth-ui-copy.json').read_text())
accounts={'synthetic-a':None,'synthetic-b':'Other user'}
active='synthetic-a'
report={'checks':[],'errors':[],'writes':[],'mode':'Synthetic account data only'}

def ok(name,condition=True):
    assert condition,name
    report['checks'].append(name)

def route_request(route):
    global active
    req=route.request;u=urlsplit(req.url)
    if u.hostname not in ['127.0.0.1','localhost']:
        route.abort();return
    if not u.path.startswith('/api/backend'):
        route.continue_();return
    status=200;data={}
    if u.path.endswith('/api/identity/me'):
        if active: data={'user_id':active,'created_at':'2026-09-17T00:00:00Z','nickname':accounts[active]}
        else:status=401
    elif u.path.endswith('/api/identity/profile'):
        body=req.post_data_json
        assert req.headers.get('x-calorieapp-request')=='account-profile'
        if not active:status=401
        elif body['user_id']!=active:status=409
        else:
            accounts[active]=body['nickname'];report['writes'].append(body)
            data={'user_id':active,'created_at':'2026-09-17T00:00:00Z','nickname':accounts[active]}
    elif u.path.endswith('/api/identity/logout'):active=None
    elif u.path.endswith('/logs/overview'):
        data={'entries':[],'next_before':None,'count':0,'grades':{},'sources':{},'calories':0,'protein':0,'fat':0,'carbohydrates':0}
    elif u.path.endswith('/health'):data={'status':'ok'}
    else:report['errors'].append('Unexpected API '+u.path);status=404
    route.fulfill(status=status,content_type='application/json',body=json.dumps(data))

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,**({'executable_path':os.environ['CALORIE_BROWSER_EXECUTABLE']} if os.environ.get('CALORIE_BROWSER_EXECUTABLE') else {}))
    context=browser.new_context(viewport={'width':360,'height':950},locale='nl-NL',service_workers='block')
    context.route('**/*',route_request)
    page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
    def enter(locale='nl'):
        page.goto('http://127.0.0.1:3100/?ui_lang='+locale,wait_until='networkidle')
        age=page.locator('button[data-age-option="adult"]')
        if age.is_visible():age.click()
        expect(page.get_by_role('button',name=COPY[locale]['profile'],exact=True)).to_be_enabled()
    def button(key,locale='nl'):
        return page.get_by_role('button',name=COPY[locale][key],exact=True)
    try:
        enter();button('profile').click()
        page.get_by_label(COPY['nl']['nicknameLabel'],exact=True).fill('Piet')
        button('saveNickname').click()
        expect(page.get_by_role('status').filter(has_text=COPY['nl']['saved'])).to_be_visible()
        expect(page.locator('[data-account-identity]')).to_contain_text('Piet')
        ok('Explicit save updates the persistent fixture and visible identity',accounts['synthetic-a']=='Piet')
        page.screenshot(path=str(OUT/'nl-profile-360.png'),full_page=True)
        button('back').click();button('settings').click()
        expect(page.locator('[data-account-settings]')).to_be_visible()
        button('back').click();button('privacy').click()
        expect(page.locator('#calorieapp-account-tools')).to_be_visible()
        ok('Profile, settings and privacy have separate screens and a working back action')
        button('back').click()
        page.get_by_role('button',name=AUTH['nl']['logout'],exact=True).click()
        expect(page.locator('[data-account-identity]')).to_have_count(0)
        ok('Logout hides the nickname but preserves the account value',accounts['synthetic-a']=='Piet')
        active='synthetic-a';page.close();page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));enter()
        expect(page.locator('[data-account-identity]')).to_contain_text('Piet')
        ok('New tab and a fresh authenticated session restore the nickname from the server')
        active='synthetic-b';enter();expect(page.locator('[data-account-identity]')).to_contain_text('Other user')
        ok('Another account receives its own nickname')
        active='synthetic-a'
        for locale in COPY:
            enter(locale);button('profile',locale).click()
            expect(page.get_by_label(COPY[locale]['nicknameLabel'],exact=True)).to_have_value('Piet')
            for width in [360,412,1440]:
                page.set_viewport_size({'width':width,'height':950})
                ok(locale+' '+str(width)+'px profile has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            if locale in ['nl','ar']:page.screenshot(path=str(OUT/(locale+'-profile-1440.png')),full_page=True)
        enter();button('profile').click();button('removeNickname').click()
        expect(page.get_by_role('status').filter(has_text=COPY['nl']['removed'])).to_be_visible()
        enter();expect(page.locator('[data-account-identity]')).not_to_contain_text('Piet')
        ok('Explicit removal survives reload',accounts['synthetic-a'] is None)
        ok('No runtime errors',not report['errors']);report['status']='passed'
    except Exception as error:
        report['status']='failed';report['failure']=str(error)
        page.screenshot(path=str(OUT/'failure.png'),full_page=True)
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        context.close();browser.close()
