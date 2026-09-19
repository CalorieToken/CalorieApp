import economy from "@/config/showcase-economy.json";

export type ShowcaseAgeBand = "child" | "teen" | "adult";
export type ShowcaseSettlementRail = "CALT" | "CAL" | "XRP";

export type SettlementRailState = {
  rail: ShowcaseSettlementRail;
  enabled: boolean;
  network: "xrpl-testnet" | "xrpl-mainnet";
  realValue: boolean;
  adultOnly: boolean;
  reason?: string;
};

const rails = economy.marketplace.settlement.rails;

export function getSettlementRailState(
  rail: ShowcaseSettlementRail,
  ageBand: ShowcaseAgeBand
): SettlementRailState {
  const config = rails[rail];
  const adultOnly = rail === "CAL" || rail === "XRP";

  if (ageBand !== "adult") {
    return {
      rail,
      enabled: false,
      network: config.network,
      realValue: config.real_value,
      adultOnly,
      reason:
        ageBand === "child"
          ? "Token and NFT trading are not available in child mode."
          : "Teen mode keeps the creator economy non-value and simulated.",
    };
  }

  if (!economy.marketplace.enabled || !config.enabled) {
    return {
      rail,
      enabled: false,
      network: config.network,
      realValue: config.real_value,
      adultOnly,
      reason:
        rail === "CALT"
          ? "The CALT Testnet marketplace is prepared but not enabled."
          : "This real-value Mainnet rail is prepared but remains disabled pending separate release approval.",
    };
  }

  return {
    rail,
    enabled: true,
    network: config.network,
    realValue: config.real_value,
    adultOnly,
  };
}

export function settlementRailChoices(ageBand: ShowcaseAgeBand) {
  return (["CALT", "CAL", "XRP"] as const).map((rail) =>
    getSettlementRailState(rail, ageBand)
  );
}

export function validateListingSettlementSelection(
  acceptedRails: readonly ShowcaseSettlementRail[],
  ageBand: ShowcaseAgeBand
) {
  const unique = [...new Set(acceptedRails)];
  if (unique.length === 0) {
    return { valid: false as const, error: "Select at least one settlement rail." };
  }

  const unavailable = unique
    .map((rail) => getSettlementRailState(rail, ageBand))
    .filter((state) => !state.enabled);

  if (unavailable.length > 0) {
    return {
      valid: false as const,
      error: unavailable.map((item) => `${item.rail}: ${item.reason}`).join(" "),
    };
  }

  return { valid: true as const, rails: unique };
}

export function isMainnetSettlementRail(
  rail: ShowcaseSettlementRail
): rail is "CAL" | "XRP" {
  return rail === "CAL" || rail === "XRP";
}

export function requiresExternalWalletSignature(
  rail: ShowcaseSettlementRail
) {
  return economy.marketplace.settlement.explicit_wallet_signature_required;
}

export const showcaseEconomyConfig = economy;
