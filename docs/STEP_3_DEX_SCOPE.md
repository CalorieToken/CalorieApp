# Step 3 DEX scope and pair policy

Status: design and verified-asset registry prepared; production transaction
submission remains disabled pending legal scope and a separate security review.

## Initial pair set

The first-party selector may show only assets identified by both currency code
and issuer in `contracts/ecosystem/xrpl-dex-assets.v1.json`.

| Pair | User actions | Role |
| --- | --- | --- |
| CAL/XRP | Buy CAL and sell CAL | Primary market |
| CAL/RLUSD | Buy CAL and sell CAL | Primary market |
| XRP/RLUSD | Exchange in either direction | Routing/on-ramp bridge only |

The CAL/XRP and CAL/RLUSD AMMs were read from a validated XRPL mainnet ledger on
2026-09-08. The application must re-read validated ledger state for every quote;
the recorded pool accounts are identifiers, not a liquidity or price promise.

CAL/EUR, CAL/USD and BTC/CAL labels were observed in a third-party wallet view,
but are excluded until each issued asset's exact issuer, operator, redemption
claim and current pool state have been reviewed. A familiar ticker or icon is
not sufficient identification on XRPL.

## User flow

1. Choose **Buy CAL** or **Sell CAL** before choosing an amount.
2. Select XRP or RLUSD as the other asset.
3. If CAL is to be received, check for the exact CAL trustline and offer the
   existing Xaman TrustSet flow when it is missing.
4. Request a fresh, validated-ledger quote. Show the route, expected amount,
   minimum received or maximum spent, price impact, trading fee and network fee.
5. Stop when issuer identity, ledger freshness, liquidity or price-impact policy
   fails. Never silently fall back to a same-ticker asset from another issuer.
6. Create a bounded transaction request and let the user review and sign it in
   Xaman. The website never receives a seed or private key.
7. Report success only after the transaction is validated; otherwise show a
   retry-safe failure state without automatic resubmission.

The initial implementation should use immediate-or-cancel behavior and must not
create resting orders. It must not trade automatically, custody assets, promise
execution, or charge an undisclosed routing fee.

## Liquidity and conflicts

Pool participation by a developer, operator, treasury or other project-related
wallet does not make a pool official and does not guarantee price stability,
redemption or continued liquidity. The public interface should use a general,
accurate disclosure:

> Liquidity may be supplied by project-related or affiliated wallets as well as
> independent participants. Availability, price and execution are not guaranteed.

Personal wallet addresses and individual balances are not part of the interface
by default. Any legally required conflict disclosure should identify the
relationship and material risk without unnecessarily publishing a natural
person's complete position history.

Project and personal liquidity activity should remain separately accounted for.
Do not generate artificial volume, coordinate trades to support a quoted price,
or market a displayed APR as expected return. Keep dated, reproducible ledger
snapshots for material project-wallet disclosures.

## Release gates

- Legal review classifies the proposed interaction under MiCA and confirms which
  regions, disclosures and service relationships are permitted.
- Xaman/API terms are reviewed for transaction-signing use beyond authentication.
- Quote construction, issuer pinning, slippage bounds, idempotency and validated
  result handling receive tests and independent security review.
- Mobile buy and sell paths are tested with a dedicated low-value test wallet.
- Production thresholds are configured centrally and fail closed; they are not
  inferred from a screenshot or hard-coded marketing figures.

Until all gates pass, the website may explain the verified pairs and link to an
external market, but must not present its own live mainnet trade button.

## Regulatory references

- ESMA MiCA Article 3 definitions: <https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-3-definitions>
- ESMA MiCA Article 59 authorisation: <https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-59-authorisation>
- ESMA MiCA Article 7 marketing communications: <https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-7-marketing-communications>
- AFM crypto-party supervision: <https://www.afm.nl/nl-nl/sector/cryptopartijen/toezicht>
- XRPL decentralized exchange: <https://xrpl.org/docs/concepts/tokens/decentralized-exchange>
- Ripple RLUSD token addresses: <https://docs.ripple.com/products/stablecoin/overview/token-addresses>
- Xaman regional XRP buying options: <https://help.xaman.app/app/getting-started-with-xaman/buying-xrp>
