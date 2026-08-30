import localeRegistry from "@/config/locales.json";

export type LocaleDirection = "ltr" | "rtl";

export type SupportedLocaleDefinition = {
  tag: string;
  english_name: string;
  native_name: string;
  direction: LocaleDirection;
  source: boolean;
  aliases: string[];
};

export const sourceLocale = localeRegistry.source_locale;
export const fallbackLocale = localeRegistry.fallback_locale;
export const supportedLocales =
  localeRegistry.locales as SupportedLocaleDefinition[];

const identifierMap = new Map<string, string>();
const canonicalPrimaryTags = new Map<string, string>();

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/_/g, "-").toLowerCase();
}

for (const locale of supportedLocales) {
  identifierMap.set(normalizeIdentifier(locale.tag), locale.tag);
  for (const alias of locale.aliases) {
    identifierMap.set(normalizeIdentifier(alias), locale.tag);
  }
  if (!locale.tag.includes("-")) {
    canonicalPrimaryTags.set(locale.tag.toLowerCase(), locale.tag);
  }
}

export function resolveLocale(value?: string | null): string {
  if (value) {
    for (const part of value.split(",")) {
      const rawCandidate = part.split(";", 1)[0]?.trim();
      if (!rawCandidate || rawCandidate === "*") {
        continue;
      }
      const candidate = normalizeIdentifier(rawCandidate);
      const exact = identifierMap.get(candidate);
      if (exact) {
        return exact;
      }
      const primary = candidate.split("-", 1)[0];
      const supportedPrimary = canonicalPrimaryTags.get(primary);
      if (supportedPrimary) {
        return supportedPrimary;
      }
    }
  }
  return fallbackLocale;
}

export function localeDirection(value?: string | null): LocaleDirection {
  const resolved = resolveLocale(value);
  return (
    supportedLocales.find((locale) => locale.tag === resolved)?.direction ??
    "ltr"
  );
}
