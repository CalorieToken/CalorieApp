"""Bounded transactional pilot repository, deliberately not exposed by live routes.

All user ids must come from CalorieApp authentication; wallets from the separate
server-side app rail. Public payment hashes never grant read or write access.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import secrets
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.engine import Engine

from .policy import CONSENT_VERSION, POLICY_VERSION, asset, currency, decimal, money, pricing
from .rail import AppPaymentRail, payment, verify_payment, account

metadata = sa.MetaData()
members = sa.Table('pilot_member', metadata,
    sa.Column('id', sa.String(36), primary_key=True),
    sa.Column('user_id', sa.String(255), nullable=False),
    sa.Column('network', sa.String(7), nullable=False),
    sa.Column('wallet', sa.String(35), nullable=False),
    sa.Column('merchant', sa.Boolean, nullable=False),
    sa.Column('consumer', sa.Boolean, nullable=False),
    sa.Column('consent', sa.String(64), nullable=False),
    sa.Column('created_at', sa.Integer, nullable=False),
    sa.UniqueConstraint('user_id', 'network'),
    sa.CheckConstraint("network IN ('mainnet','testnet')"))
products = sa.Table('pilot_product', metadata,
    sa.Column('id', sa.String(36), primary_key=True),
    sa.Column('merchant_id', sa.String(36), sa.ForeignKey('pilot_member.id'), nullable=False, index=True),
    sa.Column('sku', sa.String(48), nullable=False), sa.Column('name', sa.String(120), nullable=False),
    sa.Column('stock', sa.Integer, nullable=False),
    sa.Column('currency', sa.String(3), nullable=False),
    sa.Column('unit_price_minor', sa.BigInteger, nullable=False),
    sa.Column('unit_cost_minor', sa.BigInteger),
    sa.Column('food', sa.JSON),
    sa.UniqueConstraint('merchant_id', 'sku'), sa.CheckConstraint('stock >= 0 AND stock <= 1000000'),
    sa.CheckConstraint('unit_price_minor >= 0'), sa.CheckConstraint('unit_cost_minor IS NULL OR unit_cost_minor >= 0'))
orders = sa.Table('pilot_order', metadata,
    sa.Column('id', sa.String(36), primary_key=True),
    sa.Column('merchant_id', sa.String(36), sa.ForeignKey('pilot_member.id'), nullable=False, index=True),
    sa.Column('buyer_id', sa.String(36), sa.ForeignKey('pilot_member.id'), nullable=False, index=True),
    sa.Column('request_key', sa.String(64), nullable=False),
    sa.Column('request_digest', sa.String(64), nullable=False),
    sa.Column('network', sa.String(7), nullable=False), sa.Column('asset_key', sa.String(32), nullable=False),
    sa.Column('token_amount', sa.String(32), nullable=False),
    sa.Column('currency', sa.String(3), nullable=False), sa.Column('total_minor', sa.BigInteger, nullable=False),
    sa.Column('items', sa.JSON, nullable=False), sa.Column('status', sa.String(12), nullable=False),
    sa.Column('invoice_id', sa.String(64), nullable=False, unique=True),
    sa.Column('expected_tx', sa.JSON), sa.Column('proof', sa.JSON),
    sa.Column('fee_limit_drops', sa.String(16)),
    sa.Column('tx_hash', sa.String(64)),
    sa.Column('policy_version', sa.String(40), nullable=False),
    sa.Column('buyer_consent', sa.String(64)),
    sa.Column('created_at', sa.Integer, nullable=False), sa.Column('settled_at', sa.Integer),
    sa.UniqueConstraint('merchant_id', 'request_key'), sa.UniqueConstraint('network', 'tx_hash'),
    sa.CheckConstraint("status IN ('draft','accepted','settled','void')"),
    sa.CheckConstraint("network IN ('mainnet','testnet')"), sa.CheckConstraint('total_minor >= 0'))
movements = sa.Table('pilot_stock_movement', metadata,
    sa.Column('id', sa.String(36), primary_key=True),
    sa.Column('merchant_id', sa.String(36), sa.ForeignKey('pilot_member.id'), nullable=False, index=True),
    sa.Column('product_id', sa.String(36), sa.ForeignKey('pilot_product.id'), nullable=False),
    sa.Column('request_key', sa.String(64), nullable=False),
    sa.Column('delta', sa.Integer, nullable=False), sa.Column('kind', sa.String(16), nullable=False),
    sa.Column('created_at', sa.Integer, nullable=False), sa.UniqueConstraint('merchant_id', 'request_key'),
    sa.CheckConstraint("kind IN ('opening','restock','waste','correction','reserve','release')"))
logs = sa.Table('pilot_diary_link', metadata,
    sa.Column('id', sa.String(36), primary_key=True),
    sa.Column('order_id', sa.String(36), sa.ForeignKey('pilot_order.id'), nullable=False),
    sa.Column('buyer_id', sa.String(36), sa.ForeignKey('pilot_member.id'), nullable=False),
    sa.Column('product_id', sa.String(36), nullable=False),
    sa.Column('request_key', sa.String(64), nullable=False),
    sa.Column('consumed_units', sa.String(32), nullable=False),
    sa.Column('food_log_id', sa.Integer, nullable=False),
    sa.UniqueConstraint('buyer_id', 'request_key'))
practice_diary = sa.Table('pilot_practice_diary', metadata,
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('buyer_id', sa.String(36), sa.ForeignKey('pilot_member.id'), nullable=False),
    sa.Column('food', sa.JSON, nullable=False), sa.Column('created_at', sa.Integer, nullable=False))


def now() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def bounded(value: str, length: int) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > length or any(ord(c) < 32 for c in value):
        raise ValueError('Invalid text')
    return value.strip()


def quantity(value: int, *, zero=False) -> int:
    if type(value) is not int or not (0 if zero else 1) <= value <= 1000000:
        raise ValueError('Enter a whole number of sale units')
    return value


def snapshot(food: dict | None) -> dict | None:
    if food is None:
        return None
    # One explicitly labelled sale unit, not automatically per100g or a whole pack.
    if set(food) != {'product_name', 'calories', 'protein', 'fat', 'carbohydrates', 'serving_size', 'source'}:
        raise ValueError('Food needs all four nutrients and a source/basis for one sale unit')
    result = {key: bounded(food[key], size) for key, size in [('product_name',120),('serving_size',80),('source',160)]}
    for key in ('calories', 'protein', 'fat', 'carbohydrates'):
        value = decimal(food[key], places=3, allow_zero=True)
        if value > 100000:
            raise ValueError('Nutrition exceeds the supported limit')
        result[key] = str(value)
    return result


class PilotStore:
    def __init__(self, engine: Engine, rail: AppPaymentRail):
        if rail.rail_id != 'calorieapp':
            raise ValueError('Only the separate CalorieApp payment rail is supported')
        self.engine, self.rail = engine, rail

    @contextmanager
    def transaction(self):
        with self.engine.connect() as connection:
            # SQLite only supports local tests. PostgreSQL locks use SELECT FOR UPDATE.
            if connection.dialect.name == 'sqlite':
                connection.exec_driver_sql('BEGIN IMMEDIATE')
            else:
                connection.begin()
            try:
                yield connection
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def _member(self, c, user_id, network, role=None):
        row = c.execute(sa.select(members).where(members.c.user_id == user_id, members.c.network == network).with_for_update()).mappings().first()
        if not row or (role and not row[role]) or row['consent'] != CONSENT_VERSION:
            raise PermissionError('Opt in to this role and network first')
        return row

    def _wallet(self, user_id, network):
        proof = self.rail.wallet(user_id, network)
        if (proof.user_id, proof.network, proof.rail_id) != (user_id, network, 'calorieapp'):
            raise PermissionError('The app rail has not proved this wallet and network')
        return account(proof.address)

    def enroll(self, user_id: str, network: str, *, merchant: bool, consumer: bool, consent: str):
        bounded(user_id, 255)
        if network not in ('mainnet','testnet') or consent != CONSENT_VERSION or type(merchant) is not bool or type(consumer) is not bool or not (merchant or consumer):
            raise ValueError('Separate explicit participation and network consent is required')
        wallet = self._wallet(user_id, network)
        with self.transaction() as c:
            old = c.execute(sa.select(members).where(members.c.user_id == user_id, members.c.network == network)).mappings().first()
            if old:
                if old['wallet'] != wallet:
                    raise PermissionError('Changing a pilot wallet requires a separate reviewed process')
                c.execute(members.update().where(members.c.id == old['id']).values(merchant=merchant, consumer=consumer, consent=consent))
                return old['id']
            member_id = str(uuid4())
            c.execute(members.insert().values(id=member_id,user_id=user_id,network=network,wallet=wallet,merchant=merchant,consumer=consumer,consent=consent,created_at=now()))
            return member_id

    def add_product(self, user_id, network, *, sku, name, stock, unit_price, fiat_currency, unit_cost=None, food=None):
        quantity(stock, zero=True); bounded(sku,48); bounded(name,120)
        price = money(unit_price,fiat_currency)
        cost = money(unit_cost,fiat_currency) if unit_cost is not None else None
        food = snapshot(food)
        with self.transaction() as c:
            merchant = self._member(c,user_id,network,'merchant')
            if c.scalar(sa.select(sa.func.count()).select_from(products).where(products.c.merchant_id==merchant['id'])) >= 500:
                raise ValueError('Pilot product limit reached')
            product_id = str(uuid4())
            c.execute(products.insert().values(id=product_id,merchant_id=merchant['id'],sku=sku,name=name,stock=stock,currency=fiat_currency,unit_price_minor=price,unit_cost_minor=cost,food=food))
            self._movement(c,merchant['id'],product_id,'opening:'+product_id,stock,'opening')
            return product_id

    def _movement(self,c,merchant_id,product_id,key,delta,kind):
        if c.scalar(sa.select(sa.func.count()).select_from(movements).where(movements.c.merchant_id==merchant_id)) >= 10000:
            raise ValueError('Pilot movement limit reached; no history is silently deleted')
        c.execute(movements.insert().values(id=str(uuid4()),merchant_id=merchant_id,product_id=product_id,request_key=key,delta=delta,kind=kind,created_at=now()))

    def adjust_stock(self,user_id,network,*,product_id,delta,kind,request_key):
        bounded(request_key,64)
        if type(delta) is not int or not 0 < abs(delta) <= 1000000 or kind not in ('restock','waste','correction') or (kind=='restock' and delta<0) or (kind=='waste' and delta>0):
            raise ValueError('Invalid stock movement')
        with self.transaction() as c:
            merchant=self._member(c,user_id,network,'merchant')
            existing=c.execute(sa.select(movements).where(movements.c.merchant_id==merchant['id'],movements.c.request_key==request_key)).mappings().first()
            if existing:
                if (existing['product_id'],existing['delta'],existing['kind']) != (product_id,delta,kind):
                    raise ValueError('Idempotency key reused for a different adjustment')
                return
            result=c.execute(products.update().where(products.c.id==product_id,products.c.merchant_id==merchant['id'],products.c.stock+delta>=0,products.c.stock+delta<=1000000).values(stock=products.c.stock+delta))
            if result.rowcount!=1: raise ValueError('Product unavailable or insufficient stock')
            self._movement(c,merchant['id'],product_id,request_key,delta,kind)

    def create_order(self,user_id,network,*,buyer_user_id,items,asset_key,token_amount,request_key):
        selected=asset(asset_key,network); decimal(token_amount,places=6 if selected.currency=='XRP' else 12)
        bounded(request_key,64)
        if buyer_user_id==user_id or not isinstance(items,list) or not 1<=len(items)<=20:
            raise ValueError('Choose a different buyer and 1–20 product lines')
        ids=[]
        for item in items:
            if set(item)!= {'product_id','quantity'}: raise ValueError('Invalid order item')
            bounded(item['product_id'],36); quantity(item['quantity']);ids.append(item['product_id'])
        if len(set(ids))!=len(ids): raise ValueError('Combine repeated products into one line')
        digest=hashlib.sha256(json.dumps([buyer_user_id,items,asset_key,token_amount],sort_keys=True).encode()).hexdigest()
        with self.transaction() as c:
            merchant=self._member(c,user_id,network,'merchant')
            old=c.execute(sa.select(orders).where(orders.c.merchant_id==merchant['id'],orders.c.request_key==request_key)).mappings().first()
            if old:
                if old['request_digest']!=digest: raise ValueError('Idempotency key reused for a different order')
                return old['id']
            buyer=self._member(c,buyer_user_id,network,'consumer')
            if c.scalar(sa.select(sa.func.count()).select_from(orders).where(orders.c.buyer_id==buyer['id']))>=2000:
                raise ValueError('Pilot purchase limit reached')
            if buyer['wallet']==merchant['wallet']: raise ValueError('Buyer and seller wallets must differ')
            if c.scalar(sa.select(sa.func.count()).select_from(orders).where(orders.c.merchant_id==merchant['id']))>=2000:
                raise ValueError('Pilot order limit reached')
            lines=[]; currencies=set(); total=0
            order_id=str(uuid4())
            for item in sorted(items,key=lambda x:x['product_id']):
                product=c.execute(sa.select(products).where(products.c.id==item['product_id'],products.c.merchant_id==merchant['id']).with_for_update()).mappings().first()
                if not product or product['stock']<item['quantity']: raise ValueError('Product unavailable or insufficient stock')
                count=item['quantity']; currencies.add(product['currency']); total+=count*product['unit_price_minor']
                lines.append({'product_id':product['id'],'name':product['name'],'quantity':count,'unit_price_minor':product['unit_price_minor'],'unit_cost_minor':product['unit_cost_minor'],'food':product['food']})
                c.execute(products.update().where(products.c.id==product['id']).values(stock=products.c.stock-count))
                self._movement(c,merchant['id'],product['id'],order_id+':'+str(len(lines)),-count,'reserve')
            if total > 9000000000000000: raise ValueError('Order exceeds the reference amount limit')
            if len(currencies)!=1: raise ValueError('One reference currency per purchase')
            c.execute(orders.insert().values(id=order_id,merchant_id=merchant['id'],buyer_id=buyer['id'],request_key=request_key,request_digest=digest,network=network,asset_key=asset_key,token_amount=token_amount,currency=currencies.pop(),total_minor=total,items=lines,status='draft',invoice_id=secrets.token_hex(32).upper(),policy_version=POLICY_VERSION,created_at=now()))
            return order_id

    def _order(self,c,user_id,network,order_id,role):
        member=self._member(c,user_id,network,role)
        field=orders.c.merchant_id if role=='merchant' else orders.c.buyer_id
        order=c.execute(sa.select(orders).where(orders.c.id==order_id,orders.c.network==network,field==member['id']).with_for_update()).mappings().first()
        if not order: raise PermissionError('Purchase not available to this account')
        return member,order

    def accept(self,user_id,network,*,order_id,consent,last_ledger,fee_limit_drops):
        # last_ledger MUST be supplied by a future pinned server-side ledger adapter.
        if consent!=CONSENT_VERSION: raise ValueError('Review and explicitly accept this purchase')
        if not isinstance(fee_limit_drops,str) or not fee_limit_drops.isdigit() or not 0<int(fee_limit_drops)<=1000000:
            raise ValueError('Review a maximum XRP network fee (at most 1 XRP in this pilot)')
        with self.transaction() as c:
            buyer,order=self._order(c,user_id,network,order_id,'consumer')
            if order['status']=='accepted': return order['expected_tx']
            if order['status']!='draft': raise ValueError('Purchase is no longer awaiting acceptance')
            merchant=c.execute(sa.select(members).where(members.c.id==order['merchant_id'])).mappings().one()
            if not merchant['merchant'] or merchant['consent']!=CONSENT_VERSION: raise PermissionError('Merchant has withdrawn')
            if self._wallet(user_id,network)!=buyer['wallet'] or self._wallet(merchant['user_id'],network)!=merchant['wallet']:
                raise PermissionError('Wallet identity changed')
            tx=payment(selected=asset(order['asset_key'],network),value=order['token_amount'],source=buyer['wallet'],destination=merchant['wallet'],invoice_id=order['invoice_id'],last_ledger=last_ledger)
            c.execute(orders.update().where(orders.c.id==order_id).values(status='accepted',buyer_consent=consent,expected_tx=tx,fee_limit_drops=fee_limit_drops))
            return tx

    def void(self,user_id,network,*,order_id):
        with self.transaction() as c:
            merchant,order=self._order(c,user_id,network,order_id,'merchant')
            if order['status']=='void': return
            # Accepted/pending funds must be reconciled before stock can be released.
            if order['status']!='draft': raise ValueError('Accepted payments require reconciliation; stock stays reserved')
            for index,line in enumerate(order['items']):
                c.execute(products.update().where(products.c.id==line['product_id']).values(stock=products.c.stock+line['quantity']))
                self._movement(c,merchant['id'],line['product_id'],'void:'+order_id+':'+str(index),line['quantity'],'release')
            c.execute(orders.update().where(orders.c.id==order_id).values(status='void'))

    def settle(self,user_id,network,*,order_id,tx_hash):
        # Both reading this order and requesting a check require its buyer identity.
        with self.transaction() as c:
            _,order=self._order(c,user_id,network,order_id,'consumer')
            if order['status']=='settled':
                if order['tx_hash']!=tx_hash: raise ValueError('Purchase already has a different receipt')
                return order['proof']
            if order['status']!='accepted': raise ValueError('Purchase has not been accepted')
            result=self.rail.transaction(network=network,tx_hash=tx_hash)
            proof=verify_payment(result,network=network,expected_hash=tx_hash,expected=order['expected_tx'],fee_limit_drops=order['fee_limit_drops'])
            c.execute(orders.update().where(orders.c.id==order_id).values(status='settled',tx_hash=tx_hash,proof=proof,settled_at=now()))
            return proof

    def overview(self,user_id,network,role,*,limit=25,offset=0):
        if role not in ('merchant','consumer'): raise ValueError('Invalid role')
        if type(limit) is not int or not 1<=limit<=100 or type(offset) is not int or not 0<=offset<=10000:
            raise ValueError('Invalid page')
        with self.transaction() as c:
            member=self._member(c,user_id,network,role)
            field=orders.c.merchant_id if role=='merchant' else orders.c.buyer_id
            rows=c.execute(sa.select(orders).where(field==member['id']).order_by(orders.c.created_at.desc(),orders.c.id)).mappings().all()
            # Never total unlike assets/currencies or count unsigned/failed payments as sales.
            totals={}; token_totals={}; fee_drops=0; receipts=[]
            for row in rows:
                clean={key:row[key] for key in ('id','network','asset_key','token_amount','currency','total_minor','status','created_at','settled_at','tx_hash')}
                clean['items']=[{k:v for k,v in line.items() if k!='unit_cost_minor' or role=='merchant'} for line in row['items']]
                receipts.append(clean)
                if row['status']=='settled':
                    group=totals.setdefault(row['currency'],{'reference_minor':0,'count':0})
                    group['reference_minor']+=row['total_minor'];group['count']+=1
                    token_totals[row['asset_key']]=token_totals.get(row['asset_key'],Decimal(0))+Decimal(row['token_amount'])
                    fee_drops+=int(row['proof']['network_fee_drops'])
            stock=[]
            if role=='merchant':
                stock=[dict(row) for row in c.execute(sa.select(products).where(products.c.merchant_id==member['id']).order_by(products.c.name)).mappings()]
            return {'network':network,'practice':network=='testnet','role':role,'totals':totals,'orders':receipts[offset:offset+limit],'order_count':len(receipts),'products':stock,'token_totals':{k:str(v) for k,v in token_totals.items()},'buyer_network_fee_drops':str(fee_drops),'pricing':pricing()}

    def log_consumption(self,user_id,network,*,order_id,product_id,consumed_units,request_key,confirmed):
        """Explicit reviewed consumption; one atomic entry plus private retry receipt."""
        from ..models import FoodLogDB
        if confirmed is not True: raise ValueError('Review the portion before saving')
        amount=decimal(consumed_units,places=3);bounded(request_key,64)
        with self.transaction() as c:
            buyer,order=self._order(c,user_id,network,order_id,'consumer')
            if order['status']!='settled': raise ValueError('Payment is not confirmed')
            previous=c.execute(sa.select(logs).where(logs.c.buyer_id==buyer['id'],logs.c.request_key==request_key)).mappings().first()
            if previous:
                if (previous['order_id'],previous['product_id'],Decimal(previous['consumed_units']))!=(order_id,product_id,amount):
                    raise ValueError('Idempotency key reused for a different portion')
                return previous['food_log_id']
            line=next((x for x in order['items'] if x['product_id']==product_id),None)
            if not line or not line['food']: raise ValueError('Nutrition per sale unit is missing; choose a food source first')
            consumed=sum((Decimal(x) for x in c.scalars(sa.select(logs.c.consumed_units).where(logs.c.order_id==order_id,logs.c.product_id==product_id))),Decimal(0))
            if consumed+amount>line['quantity']: raise ValueError('Portion exceeds the unlogged purchased quantity')
            # Serialize with the existing diary budget on PostgreSQL.
            if c.dialect.name=='postgresql':
                from ..data_growth import _postgresql_lock_key
                c.execute(sa.text("SET LOCAL lock_timeout = '3000ms'"))
                c.execute(sa.text('SELECT pg_advisory_xact_lock(:key)'),{'key':_postgresql_lock_key(user_id)})
            food_table=FoodLogDB.__table__
            if c.scalar(sa.select(sa.func.count()).select_from(logs).where(logs.c.buyer_id==buyer['id']))>=10000:
                raise ValueError('Pilot diary limit reached')
            if network=='mainnet' and c.scalar(sa.select(sa.func.count()).select_from(food_table).where(food_table.c.owner_id==user_id))>=10000:
                raise ValueError('Food diary limit reached')
            food=line['food']; payload={key:float(Decimal(food[key])*amount) for key in ('calories','protein','fat','carbohydrates')}
            if network=='testnet':
                entry=c.execute(practice_diary.insert().values(buyer_id=buyer['id'],food={**payload,'product_name':food['product_name'],'serving_size':str(amount)+' × '+food['serving_size'],'source':food['source']},created_at=now()))
            else:
                entry=c.execute(food_table.insert().values(owner_id=user_id,product_name=food['product_name'],**payload,portion_percentage=100,brand=food['source'],serving_size=(str(amount)+' × '+food['serving_size'])[:80],created_at=datetime.now(timezone.utc).replace(tzinfo=None)))
            log_id=entry.inserted_primary_key[0]
            c.execute(logs.insert().values(id=str(uuid4()),order_id=order_id,buyer_id=buyer['id'],product_id=product_id,request_key=request_key,consumed_units=str(amount),food_log_id=log_id))
            return log_id
