"""App-owned signing adapter seam; no website credentials or signing side effects."""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Protocol
import re

from .policy import Asset, decimal


class RailUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class VerifiedWallet:
    # Supplied only by a future server-side app-rail proof adapter, never a browser.
    user_id: str
    network: str
    address: str
    rail_id: str = 'calorieapp'


class AppPaymentRail(Protocol):
    rail_id: str
    def wallet(self, user_id: str, network: str) -> VerifiedWallet: ...
    def prepare(self, *, user_id: str, network: str, invoice_id: str, tx: dict) -> dict: ...
    def transaction(self, *, network: str, tx_hash: str) -> dict: ...


class UnconfiguredAppRail:
    rail_id = 'calorieapp'
    def wallet(self, user_id: str, network: str) -> VerifiedWallet:
        raise RailUnavailable('The separate CalorieApp payment rail has not been connected.')
    def prepare(self, **kwargs):
        raise RailUnavailable('Signing is disabled until the app rail is verified.')
    def transaction(self, **kwargs):
        raise RailUnavailable('Ledger verification is not connected.')


def account(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r'r[1-9A-HJ-NP-Za-km-z]{24,34}', value):
        raise ValueError('Invalid XRPL account')
    # Checksum/existence must additionally be checked by the app-rail adapter.
    return value


def payment(*, selected: Asset, value: str, source: str, destination: str, invoice_id: str,
            last_ledger: int, destination_tag: int | None = None) -> dict:
    if source == destination:
        raise ValueError('Buyer and merchant wallets must differ')
    if not re.fullmatch(r'[A-F0-9]{64}', invoice_id) or type(last_ledger) is not int or last_ledger < 1:
        raise ValueError('Invalid invoice or ledger boundary')
    amount = decimal(value, places=6 if selected.currency == 'XRP' else 12)
    delivered = str(int(amount * 1000000)) if selected.currency == 'XRP' else {
        'currency': selected.currency, 'issuer': selected.issuer, 'value': format(amount, 'f')}
    tx = {'TransactionType': 'Payment', 'Account': account(source), 'Destination': account(destination),
          'Amount': delivered, 'InvoiceID': invoice_id, 'Flags': 0, 'LastLedgerSequence': last_ledger}
    if destination_tag is not None:
        if type(destination_tag) is not int or not 0 <= destination_tag <= 4294967295:
            raise ValueError('Invalid destination tag')
        tx['DestinationTag'] = destination_tag
    # No memo, food name, account id, Paths, SendMax, exchange or platform fee.
    return tx


def _same_amount(actual, expected) -> bool:
    if isinstance(expected, str):
        return isinstance(actual, str) and actual.isdigit() and int(actual) == int(expected)
    if not isinstance(actual, dict) or set(actual) != {'currency', 'issuer', 'value'}:
        return False
    if actual['currency'] != expected['currency'] or actual['issuer'] != expected['issuer']:
        return False
    try:
        amount = actual['value']
        return isinstance(amount, str) and len(amount) <= 96 and Decimal(amount).is_finite() and Decimal(amount) == Decimal(expected['value'])
    except InvalidOperation:
        return False


def verify_payment(result: dict, *, network: str, expected_hash: str, expected: dict, fee_limit_drops: str) -> dict:
    """Input comes from pinned app-rail ledger lookup, NEVER a client receipt/webhook."""
    if not re.fullmatch(r'[A-F0-9]{64}', expected_hash):
        raise ValueError('Invalid transaction hash')
    if result.get('network') != network or result.get('validated') is not True or result.get('hash') != expected_hash:
        raise ValueError('Wrong network or transaction not validated')
    tx, meta = result.get('tx_json', {}), result.get('meta', {})
    ledger = result.get('ledger_index')
    if type(ledger) is not int or not 1 <= ledger <= expected['LastLedgerSequence']:
        raise ValueError('Wrong validated ledger')
    if meta.get('TransactionResult') != 'tesSUCCESS':
        raise ValueError('Payment was not successful')
    for key in ('TransactionType', 'Account', 'Destination', 'InvoiceID', 'LastLedgerSequence'):
        if tx.get(key) != expected[key]:
            raise ValueError('Transaction differs from the reviewed invoice')
    if tx.get('DestinationTag') != expected.get('DestinationTag'):
        raise ValueError('Destination tag differs')
    if type(tx.get('Flags', 0)) is not int or tx.get('Flags', 0) not in (0, 0x80000000):
        raise ValueError('Partial or non-direct payments are not accepted')
    if any(key in tx for key in ('Paths', 'SendMax', 'DeliverMin', 'Memos')):
        raise ValueError('Unexpected payment fields')
    if not _same_amount(tx.get('Amount'), expected['Amount']) or not _same_amount(meta.get('delivered_amount'), expected['Amount']):
        raise ValueError('The received amount or exact asset differs')
    fee = tx.get('Fee')
    if not isinstance(fee, str) or not fee.isdigit() or len(fee) > 16:
        raise ValueError('Missing network fee')
    if not isinstance(fee_limit_drops, str) or not fee_limit_drops.isdigit() or len(fee_limit_drops) > 16 or int(fee) > int(fee_limit_drops):
        raise ValueError('Network fee exceeds the reviewed maximum')
    return {'network': network, 'hash': expected_hash, 'ledger_index': ledger, 'network_fee_drops': fee}
