"use client";

import Image from "next/image";
import translations from "@/config/app-introduction-copy.json";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { localeDirection, resolveLocale } from "@/lib/locales";

function useIntroductionCopy() {
  const display = useDisplayLanguage();
  const locale = display.enabled ? resolveLocale(display.locale) : "en";
  return {
    locale,
    direction: localeDirection(locale),
    copy: translations[locale as keyof typeof translations] ?? translations.en,
  };
}

// Translators can reorder link tokens, but cannot change their destinations or
// supply HTML. Provider and licence names stay intact, including in RTL text.
const sourceLinks = [
  { token: "{off}", label: "Open Food Facts", href: "https://world.openfoodfacts.org" },
  { token: "{odbl}", label: "ODbL", href: "https://opendatacommons.org/licenses/odbl/1-0/" },
  { token: "{usda}", label: "USDA FoodData Central", href: "https://fdc.nal.usda.gov/" },
  { token: "{cc0}", label: "CC0 1.0", href: "https://creativecommons.org/publicdomain/zero/1.0/" },
];

function SourceAttribution({ text }: { text: string }) {
  return <>{text.split(/(\{(?:off|odbl|usda|cc0)\})/g).map((part, index) => {
    const link = sourceLinks.find(item => item.token === part);
    return link ? (
      <a key={index} href={link.href} target="_blank" rel="noopener noreferrer"
        className="font-semibold text-brand-secondary hover:underline">
        <bdi dir="ltr">{link.label}</bdi>
      </a>
    ) : part;
  })}</>;
}

export function AppIntroduction() {
  const { locale, direction, copy } = useIntroductionCopy();
  return (
    <div className="mb-7 flex min-w-0 items-center gap-4" lang={locale} dir={direction}>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-secondary/10 bg-white shadow-sm sm:h-16 sm:w-16">
        <Image src="/logo.png" alt={copy.logoAlt}
          className="h-full w-full scale-[1.55] object-contain" width={64} height={64} priority />
      </div>
      <div className="min-w-0 break-words">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-secondary/70">
          {copy.eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-brand-primary sm:text-3xl">
          <bdi dir="ltr">CalorieApp</bdi>
        </h1>
        <p className="mt-1 text-sm font-medium text-brand-secondary">{copy.intro}</p>
      </div>
    </div>
  );
}

export function AppSourceFooter() {
  const { locale, direction, copy } = useIntroductionCopy();
  return (
    <footer lang={locale} dir={direction} aria-label={copy.footerLabel}
      className="mx-auto mt-5 flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-brand-secondary/15 bg-white/95 px-5 py-4 text-xs leading-relaxed text-brand-secondary/80 shadow-sm">
      <p className="font-semibold text-brand-primary">
        <bdi dir="ltr">CalorieApp</bdi>{" · "}{copy.scope}
      </p>
      <p><SourceAttribution text={copy.offAttribution} /></p>
      <p><SourceAttribution text={copy.usdaAttribution} /></p>
      <div className="mt-2 flex flex-col gap-2 border-t border-brand-secondary/10 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-5">
        <p className="min-w-0 sm:flex-1 sm:basis-64">{copy.communityThanks}</p>
        <a href="https://connect.openfoodfacts.org/join-the-contributor-skill-pool-open-food-facts"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-1 self-start rounded-lg px-2 py-2 font-semibold text-brand-primary underline decoration-brand-primary/30 underline-offset-4 transition hover:decoration-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary sm:self-auto">
          <span className="min-w-0 break-words">{copy.contribute}</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </footer>
  );
}
