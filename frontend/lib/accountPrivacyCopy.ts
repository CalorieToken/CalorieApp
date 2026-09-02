import copyRegistry from "@/config/account-privacy-copy.json";
import { localeDirection, resolveLocale, type LocaleDirection } from "@/lib/locales";

export type AccountExportCopy = {
  section_label: string;
  title: string;
  description: string;
  button_idle: string;
  button_busy: string;
  session_expired: string;
  review_required: string;
  success: string;
  unavailable: string;
};

export type AccountErasureCopy = {
  section_label: string;
  title: string;
  description: string;
  review_button: string;
  confirmation_intro: string;
  account_identifier: string;
  acknowledgement: string;
  button_busy: string;
  button_confirm: string;
  button_cancel: string;
  session_expired: string;
  confirmation_failed: string;
  temporarily_unavailable: string;
  unavailable: string;
  success: string;
};

export type AccountPrivacyCopy = {
  locale: string;
  direction: LocaleDirection;
  export: AccountExportCopy;
  erasure: AccountErasureCopy;
};

const translations = copyRegistry.locales as Record<
  string,
  { export: AccountExportCopy; erasure: AccountErasureCopy }
>;

export function getAccountPrivacyCopy(locale?: string | null): AccountPrivacyCopy {
  const resolved = resolveLocale(locale);
  const translation = translations[resolved] ?? translations.en;

  return {
    locale: translations[resolved] ? resolved : "en",
    direction: localeDirection(resolved),
    export: translation.export,
    erasure: translation.erasure,
  };
}
