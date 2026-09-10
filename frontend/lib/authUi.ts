import translations from "@/config/auth-ui-copy.json";
import { localeDirection, resolveLocale } from "@/lib/locales";

export type AuthUiCopy = typeof translations.en;
export function getAuthUi(value?: string | null) {
  const locale = resolveLocale(value);
  return { locale, direction: localeDirection(locale), copy: translations[locale as keyof typeof translations] ?? translations.en };
}
const messages = new Map<string, keyof AuthUiCopy>(
  (Object.keys(translations.en) as (keyof AuthUiCopy)[]).map(key => [translations.en[key], key]),
);
messages.set("Sign-in completed. Your session was restored in this browser.", "complete");
messages.set("WordPress signed in. Restoring CalorieApp in this browser...", "reconnecting");
messages.set("Could not log out of both sessions. Please try again.", "logoutFailed");

export function translateAuthMessage(message: string, copy: AuthUiCopy): string {
  // Display only: the protocol locale, request state and server messages stay intact.
  // Only exact first-party messages belong to this catalogue.
  const key = messages.get(message);
  return key ? copy[key] : message;
}
