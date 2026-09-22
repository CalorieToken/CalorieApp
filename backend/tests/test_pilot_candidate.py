"""Tests use invented participants and in-memory databases, never real funds."""
from copy import deepcopy
from decimal import Decimal
import json
from pathlib import Path

import pytest
import sqlalchemy as sa
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from app.models import FoodLogDB, CalorieAppUserDB
from app.pilot.policy import CONSENT_VERSION, CURRENCY_SUGGESTIONS, ASSETS, asset, decimal, money, display_estimate, pricing
from app.pilot.rail import VerifiedWallet, UnconfiguredAppRail, RailUnavailable, verify_payment
from app.pilot.store import PilotStore, metadata, orders, products, movements, logs, practice_diary

MERCHANT='rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY'
BUYER='rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'
HASH='A'*64
FOOD={'product_name':'One biscuit','calories':'100','protein':'2','fat':'4','carbohydrates':'14','serving_size':'1 biscuit, 20 g','source':'Manually entered package label, per biscuit'}

class FakeRail:
    rail_id='calorieapp'
    def __init__(self): self.result={}
    def wallet(self,user_id,network):
        return VerifiedWallet(user_id,network,MERCHANT if user_id=='seller' else BUYER)
    def transaction(self,**kwargs): return deepcopy(self.result)

@pytest.fixture
def pilot():
    engine=sa.create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    SQLModel.metadata.create_all(engine);metadata.create_all(engine)
    with engine.begin() as c:
        c.execute(CalorieAppUserDB.__table__.insert(),[{'id':x,'status':'active'} for x in ('seller','buyer','stranger')])
    rail=FakeRail(); store=PilotStore(engine,rail)
    for network in ('mainnet','testnet'):
        store.enroll('seller',network,merchant=True,consumer=False,consent=CONSENT_VERSION)
        store.enroll('buyer',network,merchant=False,consumer=True,consent=CONSENT_VERSION)
        store.enroll('stranger',network,merchant=False,consumer=True,consent=CONSENT_VERSION)
    yield store,rail,engine
    engine.dispose()

def make_order(pilot,network='mainnet',count=2,key='buy-1',symbol='XRP'):
    store,rail,engine=pilot
    product=store.add_product('seller',network,sku=key,name='Biscuits',stock=12,unit_price='0.50',fiat_currency='EUR',unit_cost='0.20',food=FOOD)
    order=store.create_order('seller',network,buyer_user_id='buyer',items=[{'product_id':product,'quantity':count}],asset_key=network+':'+symbol,token_amount='1.25',request_key=key)
    return product,order

def paid(pilot,network='mainnet',symbol='XRP'):
    store,rail,engine=pilot; product,order=make_order(pilot,network,symbol=symbol)
    tx=store.accept('buyer',network,order_id=order,consent=CONSENT_VERSION,last_ledger=120,fee_limit_drops='1000')
    rail.result={'network':network,'validated':True,'hash':HASH,'ledger_index':115,'tx_json':{**tx,'Fee':'12'},'meta':{'TransactionResult':'tesSUCCESS','delivered_amount':deepcopy(tx['Amount'])}}
    store.settle('buyer',network,order_id=order,tx_hash=HASH)
    return product,order,tx

@pytest.mark.parametrize('bad',[0,1.2,'NaN','Infinity','1e3','-1','0','0.0000000000001','1,25',True,'01'])
def test_amounts_reject_lossy_or_invalid_input(bad):
    with pytest.raises(ValueError): decimal(bad)

def test_money_currency_and_free_policy():
    assert money('12.34','EUR')==1234
    assert display_estimate(1234,'EUR','USD','1.1')=='13.57'
    assert money('123','XOF')==123
    with pytest.raises(ValueError): money('123.10','XOF')
    assert set(CURRENCY_SUGGESTIONS)=={'en','nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur'}
    assert all(not x['paywall'] and x['platform_price']=='0' for x in pricing()['features'].values())
    contract=json.loads((Path(__file__).parents[2]/'contracts/pilot/v1/pricing.json').read_text())
    assert contract['version']==pricing()['version']
    assert contract['billing_enabled'] is False and contract['accrue_deferred_fees'] is False

def test_exact_assets_no_network_mix_or_guessed_calt():
    assert asset('mainnet:RLUSD','mainnet').issuer==BUYER
    for key,network in [('mainnet:XRP','testnet'),('testnet:CALT','testnet'),('CAL','mainnet')]:
        with pytest.raises(ValueError): asset(key,network)

def test_rail_missing_fails_closed_and_website_forbidden(pilot):
    store,rail,engine=pilot
    with pytest.raises(RailUnavailable): UnconfiguredAppRail().wallet('buyer','mainnet')
    rail.rail_id='website'
    with pytest.raises(ValueError): PilotStore(engine,rail)

def test_both_participants_opt_in_before_order(pilot):
    store,_,_=pilot
    with pytest.raises(ValueError): store.enroll('new','testnet',merchant=True,consumer=False,consent='yes')
    product,order=make_order(pilot)
    assert store.overview('buyer','mainnet','consumer')['totals']=={}
    with pytest.raises(ValueError): store.accept('buyer','mainnet',order_id=order,consent='',last_ledger=120,fee_limit_drops='1000')

def test_stock_reserve_retry_void_and_no_overselling(pilot):
    store,rail,engine=pilot;product,order=make_order(pilot)
    args=dict(buyer_user_id='buyer',items=[{'product_id':product,'quantity':2}],asset_key='mainnet:XRP',token_amount='1.25',request_key='buy-1')
    assert store.create_order('seller','mainnet',**args)==order
    assert store.overview('seller','mainnet','merchant')['products'][0]['stock']==10
    with pytest.raises(ValueError): store.create_order('seller','mainnet',**{**args,'request_key':'oversell','items':[{'product_id':product,'quantity':11}]})
    with pytest.raises(ValueError): store.create_order('seller','mainnet',**{**args,'token_amount':'2'})
    store.void('seller','mainnet',order_id=order);store.void('seller','mainnet',order_id=order)
    assert store.overview('seller','mainnet','merchant')['products'][0]['stock']==12

def test_stock_correction_idempotency_and_rollback(pilot):
    store,_,_=pilot;product,_=make_order(pilot)
    args=dict(product_id=product,delta=-3,kind='waste',request_key='waste-1')
    store.adjust_stock('seller','mainnet',**args);store.adjust_stock('seller','mainnet',**args)
    assert store.overview('seller','mainnet','merchant')['products'][0]['stock']==7
    with pytest.raises(ValueError): store.adjust_stock('seller','mainnet',**{**args,'delta':-4})
    with pytest.raises(PermissionError): store.adjust_stock('buyer','mainnet',**args)

def test_settlement_only_then_sales_and_never_automatic_food_log(pilot):
    store,_,engine=pilot;product,order,tx=paid(pilot)
    assert 'Memos' not in tx and 'SendMax' not in tx
    merchant=store.overview('seller','mainnet','merchant');buyer=store.overview('buyer','mainnet','consumer')
    assert merchant['totals']=={'EUR':{'reference_minor':100,'count':1}}
    assert buyer['totals']==merchant['totals']
    assert 'unit_cost_minor' not in buyer['orders'][0]['items'][0]
    with engine.connect() as c: assert c.scalar(sa.select(sa.func.count()).select_from(FoodLogDB))==0
    assert store.settle('buyer','mainnet',order_id=order,tx_hash=HASH)['hash']==HASH
    assert merchant['products'][0]['stock']==10
    with pytest.raises(ValueError): store.void('seller','mainnet',order_id=order)

def test_other_account_and_network_cannot_accept_read_or_log(pilot):
    store,_,_=pilot;product,order=make_order(pilot)
    for user,network in [('stranger','mainnet'),('buyer','testnet')]:
        with pytest.raises(PermissionError): store.accept(user,network,order_id=order,consent=CONSENT_VERSION,last_ledger=120,fee_limit_drops='1000')
    assert store.overview('stranger','mainnet','consumer')['orders']==[]

@pytest.mark.parametrize('mutation',[
    lambda r:r.update(validated=False), lambda r:r.update(network='testnet'),
    lambda r:r.update(hash='B'*64),lambda r:r.update(ledger_index=121),
    lambda r:r['meta'].update(TransactionResult='tecPATH_PARTIAL'),
    lambda r:r['meta'].update(delivered_amount='1'),lambda r:r['meta'].pop('delivered_amount'),
    lambda r:r['tx_json'].update(Destination=BUYER), lambda r:r['tx_json'].update(InvoiceID='B'*64),
    lambda r:r['tx_json'].update(Flags=131072),lambda r:r['tx_json'].update(Paths=[]),
    lambda r:r['tx_json'].update(DestinationTag=7),lambda r:r['tx_json'].update(Memos=[]),
    lambda r:r['tx_json'].update(Amount='1'),lambda r:r['tx_json'].update(Fee='1001')])
def test_invalid_ledger_receipts_cannot_settle(pilot,mutation):
    store,rail,engine=pilot;product,order=make_order(pilot)
    tx=store.accept('buyer','mainnet',order_id=order,consent=CONSENT_VERSION,last_ledger=120,fee_limit_drops='1000')
    rail.result={'network':'mainnet','validated':True,'hash':HASH,'ledger_index':115,'tx_json':{**tx,'Fee':'12'},'meta':{'TransactionResult':'tesSUCCESS','delivered_amount':tx['Amount']}}
    mutation(rail.result)
    with pytest.raises(ValueError): store.settle('buyer','mainnet',order_id=order,tx_hash=HASH)
    assert store.overview('buyer','mainnet','consumer')['totals']=={}

def test_wrong_token_issuer_and_scientific_ledger_amount(pilot):
    store,rail,_=pilot;product,order,tx=paid(pilot,symbol='RLUSD')
    result=deepcopy(rail.result);result['meta']['delivered_amount']['value']='125e-2'
    assert verify_payment(result,network='mainnet',expected_hash=HASH,expected=tx,fee_limit_drops='1000')
    result['meta']['delivered_amount']['issuer']=MERCHANT
    with pytest.raises(ValueError): verify_payment(result,network='mainnet',expected_hash=HASH,expected=tx,fee_limit_drops='1000')

def test_portion_save_once_and_no_more_than_purchased(pilot):
    store,rail,engine=pilot;product,order,_=paid(pilot)
    args=dict(order_id=order,product_id=product,consumed_units='0.5',request_key='portion-1',confirmed=True)
    log_id=store.log_consumption('buyer','mainnet',**args)
    assert store.log_consumption('buyer','mainnet',**args)==log_id
    with engine.connect() as c:
        row=c.execute(sa.select(FoodLogDB.__table__)).mappings().one()
        assert row['calories']==50 and row['owner_id']=='buyer'
    with pytest.raises(ValueError): store.log_consumption('buyer','mainnet',**{**args,'consumed_units':'2','request_key':'portion-2'})
    with pytest.raises(PermissionError): store.log_consumption('stranger','mainnet',**args)
    with pytest.raises(ValueError): store.log_consumption('buyer','mainnet',**{**args,'confirmed':False})

def test_practice_diary_cannot_change_real_diary(pilot):
    store,rail,engine=pilot;product,order,_=paid(pilot,'testnet')
    store.log_consumption('buyer','testnet',order_id=order,product_id=product,consumed_units='1',request_key='test-portion',confirmed=True)
    with engine.connect() as c:
        assert c.scalar(sa.select(sa.func.count()).select_from(practice_diary))==1
        assert c.scalar(sa.select(sa.func.count()).select_from(FoodLogDB))==0
    assert store.overview('buyer','mainnet','consumer')['totals']=={}

def test_no_production_registration_or_price_activation():
    root=Path(__file__).parents[2]
    release=json.loads((root/'contracts/pilot/v1/release.json').read_text())
    assert not any(release[x] for x in ('public_enabled','mainnet_enabled','testnet_enabled','fees_enabled','live_migration_registered'))
    assert 'pilot' not in (root/'backend/app/main.py').read_text()


def test_multi_item_stock_changes_rollback_together(pilot):
    store,_,_=pilot
    first=store.add_product('seller','testnet',sku='one',name='First',stock=5,unit_price='1',fiat_currency='EUR')
    second=store.add_product('seller','testnet',sku='two',name='Second',stock=0,unit_price='1',fiat_currency='EUR')
    with pytest.raises(ValueError):
        store.create_order('seller','testnet',buyer_user_id='buyer',items=[{'product_id':first,'quantity':3},{'product_id':second,'quantity':1}],asset_key='testnet:XRP',token_amount='4',request_key='multi')
    stocks={x['id']:x['stock'] for x in store.overview('seller','testnet','merchant')['products']}
    assert stocks[first]==5 and stocks[second]==0


def test_mixed_asset_totals_not_added_to_fiat(pilot):
    store,_,_=pilot;paid(pilot)
    overview=store.overview('buyer','mainnet','consumer')
    assert overview['token_totals']=={'mainnet:XRP':'1.25'}
    assert overview['buyer_network_fee_drops']=='12'
    assert overview['totals']['EUR']['reference_minor']==100
    assert store.overview('buyer','mainnet','consumer',limit=1,offset=1)['orders']==[]
    with pytest.raises(ValueError): store.overview('buyer','mainnet','consumer',limit=100000)


def test_consumption_budget_failure_does_not_create_retry_receipt(pilot):
    store,rail,engine=pilot;product,order,_=paid(pilot)
    with engine.begin() as c:
        c.execute(FoodLogDB.__table__.insert(),[{'owner_id':'buyer','product_name':'Existing entry','calories':1} for _ in range(10000)])
    with pytest.raises(ValueError):
        store.log_consumption('buyer','mainnet',order_id=order,product_id=product,consumed_units='1',request_key='full',confirmed=True)
    with engine.connect() as c:
        assert c.scalar(sa.select(sa.func.count()).select_from(logs))==0
        assert c.scalar(sa.select(sa.func.count()).select_from(FoodLogDB))==10000
