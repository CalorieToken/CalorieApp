import translations from "@/config/auth-ui-copy.json";
import { localeDirection, resolveLocale } from "@/lib/locales";

export type AuthUiCopy = typeof translations.en;
export function getAuthUi(value?: string | null) {
  const locale = resolveLocale(value);
  return { locale, direction: localeDirection(locale), copy: translations[locale as keyof typeof translations] ?? translations.en };
}
const messageKeys: (keyof AuthUiCopy)[] = [
  "restoring", "complete", "restoreFailed", "preparing", "starting", "retrying",
  "busy", "activating", "reconnecting", "signedBoth", "languageMismatch",
  "responseMismatch", "finishFailed", "bridgeUnavailable", "prepareFailed", "logoutFailed", "serviceSlow", "signedOutApp",
];
const messages = new Map<string, keyof AuthUiCopy>(
  messageKeys.map(key => [translations.en[key], key]),
);
messages.set("Sign-in completed. Your session was restored in this browser.", "complete");
messages.set("WordPress signed in. Restoring CalorieApp in this browser...", "reconnecting");
messages.set("Could not log out of both sessions. Please try again.", "logoutFailed");

export function translateAuthMessage(message: string, copy: AuthUiCopy): string {
  // Display only: protocol locale and request state stay intact. Only known
  // status/error strings are translated; UI labels and unknown messages pass through.
  const key = messages.get(message);
  return key ? copy[key] : message;
}
