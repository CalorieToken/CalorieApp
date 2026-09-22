"""Exact assets, explicit locale/currency choices and zero-fee launch policy."""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re


@dataclass(frozen=True)
class Asset:
    network: str
    symbol: str
    currency: str
    issuer: str | None = None


ASSETS = {
    'mainnet:XRP': Asset('mainnet', 'XRP', 'XRP'),
    'mainnet:CAL': Asset('mainnet', 'CAL', '43616C6F72696500000000000000000000000000', 'rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY'),
    'mainnet:RLUSD': Asset('mainnet', 'RLUSD', '524C555344000000000000000000000000000000', 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'),
    'testnet:XRP': Asset('testnet', 'test XRP', 'XRP'),
}
# CALT deliberately absent: a display name is not a verified currency/issuer.
CURRENCIES = frozenset(['USD', 'GBP', 'EUR', 'CNY', 'SGD', 'INR', 'MXN', 'ARS', 'COP', 'SAR', 'AED', 'EGP', 'CAD', 'CHF', 'XOF', 'BDT', 'BRL', 'IDR', 'PKR'])
CURRENCY_SUGGESTIONS = {
    'en': ['USD', 'GBP', 'CAD'], 'nl': ['EUR'], 'zh-Hans': ['CNY', 'SGD'],
    'hi': ['INR'], 'es': ['EUR', 'MXN', 'ARS', 'COP'], 'ar': ['SAR', 'AED', 'EGP'],
    'fr': ['EUR', 'CAD', 'CHF', 'XOF'], 'bn': ['BDT', 'INR'],
    'pt': ['EUR', 'BRL'], 'id': ['IDR'], 'ur': ['PKR', 'INR'],
}
FEATURES = ('food-search', 'food-diary', 'recipes', 'alternatives', 'labels-sources',
            'purchase-expenses', 'merchant-inventory', 'merchant-sales', 'data-export',
            'advanced-reports', 'team-tools')
POLICY_VERSION = 'free-launch-2026-09-22'
CONSENT_VERSION = 'voluntary-pilot-draft-2026-09-22'


def decimal(value: str, *, places: int = 12, allow_zero: bool = False) -> Decimal:
    if not isinstance(value, str) or not re.fullmatch(r'(?:0|[1-9]\d{0,10})(?:\.\d{1,12})?', value):
        raise ValueError('Use a decimal string, without exponent or thousands separators')
    result = Decimal(value)
    normalized = result.normalize()
    if len(normalized.as_tuple().digits) > 16 or max(0, -normalized.as_tuple().exponent) > places:
        raise ValueError('Too much precision')
    if result < 0 or (result == 0 and not allow_zero):
        raise ValueError('Amount must be positive')
    return result


def asset(key: str, network: str) -> Asset:
    selected = ASSETS.get(key)
    if selected is None or selected.network != network:
        raise ValueError('Asset is not verified for this network')
    return selected


def currency(code: str) -> str:
    if code not in CURRENCIES:
        raise ValueError('Unsupported display currency')
    return code


def minor_units(code: str) -> int:
    currency(code)
    return 0 if code == 'XOF' else 2


def money(value: str, code: str) -> int:
    return int(decimal(value, places=minor_units(code), allow_zero=True) * (10 ** minor_units(code)))


def display_estimate(original_minor: int, original: str, target: str, rate: str) -> str:
    """A supplied, dated reference rate, never a settlement quote or guaranteed value."""
    if type(original_minor) is not int or original_minor < 0:
        raise ValueError('Invalid reference amount')
    amount = Decimal(original_minor) / (10 ** minor_units(original))
    return format((amount * decimal(rate)).quantize(Decimal(1).scaleb(-minor_units(target)), rounding=ROUND_HALF_UP), 'f')


def pricing() -> dict:
    # No environment variable or customer input can switch on charging.
    return {'version': POLICY_VERSION, 'mode': 'free-launch', 'subscription_minor': 0,
            'platform_fee_bps': 0, 'platform_fee_fixed': '0', 'automatic_renewal': False,
            'billing_enabled': False, 'features': {key: {'platform_price': '0', 'paywall': False} for key in FEATURES},
            'network_fees': 'Separate; final XRP fee is shown by the signing wallet.',
            'future_candidates': ['advanced-reports', 'team-tools', 'transaction-fees'],
            'future_prices': None}
