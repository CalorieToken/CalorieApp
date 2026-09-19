import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = JSON.parse(
  await readFile(
    new URL("../../frontend/config/showcase-economy.json", import.meta.url),
    "utf8"
  )
);

test("CALT remains Testnet-only and non-redeemable", () => {
  assert.equal(config.ticker, "CALT");
  assert.equal(config.environment, "xrpl-testnet");
  assert.equal(config.real_world_value, false);
  assert.equal(config.redeemable, false);
  assert.equal(config.mainnet_enabled, false);
  assert.equal(
    config.marketplace.settlement.rails.CALT.network,
    "xrpl-testnet"
  );
  assert.equal(
    config.marketplace.settlement.rails.CALT.real_value,
    false
  );
});

test("CAL and XRP Mainnet NFT rails are prepared but disabled", () => {
  for (const rail of ["CAL", "XRP"]) {
    const item = config.marketplace.settlement.rails[rail];
    assert.equal(item.network, "xrpl-mainnet");
    assert.equal(item.enabled, false);
    assert.equal(item.real_value, true);
    assert.equal(item.adult_only, true);
    assert.equal(item.independent_release_approval_required, true);
    assert.equal(item.jurisdiction_gate_required, true);
    assert.equal(item.legal_tax_consumer_review_required, true);
  }
});

test("real CAL identity is issuer-bound, not ticker-only", () => {
  const cal = config.marketplace.settlement.rails.CAL;
  assert.equal(cal.issuer, "rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY");
  assert.equal(
    cal.currency_code,
    "43616C6F72696500000000000000000000000000"
  );
});

test("marketplace stays non-custodial and never auto-converts", () => {
  const settlement = config.marketplace.settlement;
  assert.equal(settlement.non_custodial, true);
  assert.equal(settlement.explicit_wallet_signature_required, true);
  assert.equal(settlement.validated_ledger_result_required, true);
  assert.equal(settlement.automatic_cross_currency_conversion, false);
});

test("rolling newcomer CALT airdrop is one base entitlement per identity", () => {
  const newcomer = config.welcome_airdrop.newcomer_policy;
  assert.equal(newcomer.globally_available_for_future_newcomers, true);
  assert.equal(
    newcomer.one_base_entitlement_per_canonical_game_identity,
    true
  );
  assert.equal(newcomer.returning_player_does_not_reset_newcomer_status, true);
  assert.equal(
    config.welcome_airdrop.distribution_model,
    "rolling-newcomer-welcome-with-launch-wave"
  );
});
