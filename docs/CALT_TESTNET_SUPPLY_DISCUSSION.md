# CALT Testnet supply — working discussion, 19 September 2026

Status: proposal for discussion. No issuer transaction, fixed cap, mint amount,
blackhole operation or automatic replenishment has been authorized or implemented.
The current economy configuration still leaves issuer and distribution amounts unset.

## User direction

- CALT is currently the only token reward and airdrop asset.
- Participation and claims remain optional; core app/game use does not require them.
- Extra verified useful node work may earn extra bounded CALT rewards.
- The user considered matching a 100-billion reference supply and blackholing the
  Testnet issuer, then reconsidered in favor of issuing less and gradually adding
  supply for ongoing airdrops. Treat this as an evolving proposal, not a finalized cap.
- The CAL price connection remains the existing fictional display/reference model.

## Issuance, distribution and reference value are separate

Issuance creates outstanding tokens; distribution transfers an already-issued
reserve to participants. For XRPL trust-line tokens, issuer payments can issue
tokens when the necessary trust lines exist; returning tokens to the issuer
destroys them. [XRPL trust-line documentation](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-line-tokens)

Consequently, either of these models can support gradual airdrops:

| Model | Initial issuance | Later airdrops | Flexibility |
| --- | --- | --- | --- |
| Small reserve, controlled replenishment | Small, defined reward reserve | Funded by reserve and later bounded issuance | Issuer remains controllable |
| Pre-issued fixed reserve | Larger initial supply in separate distribution accounts | Gradual transfers from that finite reserve | Later issuance unavailable if issuer is correctly blackholed |

Blackholing permanently removes the issuer's signing authority and ability to
submit new issuance/settings transactions. Existing ledger obligations still need
to be considered before describing a supply as fixed. Tokens already held by
other accounts can continue circulating. [XRPL blackhole documentation](https://xrpl.org/docs/concepts/accounts/blackholed-accounts)

A nominally equal supply does not establish an equal market price. The existing
game proposal can display a simulated reference of 1 CALT to the public reference
price of 1 CAL without requiring equal total supplies. This conveys no redemption,
backing, exchange guarantee or real CAL ownership. Actual value stabilization is
a separate economic mechanism. [XRPL value-backing explanation](https://xrpl.org/docs/concepts/tokens/fungible-tokens/stablecoins)

## Recommended provisional direction

Keep the issuer controllable during the changing Testnet prototype. Start with a
small reward reserve sized from the anticipated newcomer allocation and verified
work budget for a defined period. Use a separately controlled distribution account;
the participant/game client must never have issuer authority or issuer secrets.

Before adding supply, reconcile validated issued amounts, available reserve,
pending rewards and completed distributions. Replenishment should follow a
documented budget and operational control rather than arbitrary participant
requests or the displayed CAL price. No automatic issuer signing is added now.

If 100 billion is later adopted as a project limit, specify whether the limit is
cumulative issuance or outstanding supply. Do not describe an application policy
as an immutable ledger cap while an ordinary trust-line issuer retains the ability
to issue. Total supply, minted-to-reserve and distributed-to-participants should
be reported separately. The exact limit and mint batches remain open decisions.

Welcome allocations should remain available independently of node participation.
Useful-work bonuses can share the CALT asset while using their own budget, caps
and duplicate-work checks. Existing non-financial child/teen gameplay is retained;
optional on-chain CALT remains within the existing adult Testnet boundary.

## Testnet continuity

Public XRPL Testnet can be reset, removing accounts, balances and other ledger
state. Therefore durable game progress and verified reward/claim receipts need
an application record and a defined reset/reconciliation procedure. Recreating a
test environment must not silently multiply newcomer entitlements or imply a
promise to redeem test balances for Mainnet assets.
[XRPL network documentation](https://xrpl.org/docs/concepts/networks-and-servers/parallel-networks),
[documented Testnet reset impact](https://xrpl.org/blog/2024/testnet-reset).

This proposal does not change Mainnet CAL supply, enable CAL/XRP rewards, activate
the NFT marketplace, or initiate any blockchain transaction.
