export type DisplayState = { locale: string; explicit: boolean };
export type DisplayStore = {
  get(): DisplayState;
  valid(value: unknown): boolean;
  select(locale: string): boolean;
  apply(locale: string, explicit: boolean): boolean;
  subscribe(listener: (state: DisplayState, source: "local" | "remote") => void): () => void;
};
export function createStore(options: {
  locales: string[];
  fallback: string;
  initialLocale: string;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  now?: () => number;
}): DisplayStore;
export function connectGuest(options: {
  window: Window;
  parent: Window;
  origins: string[];
  channel: string;
  store: DisplayStore;
}): () => void;
export function connectHost(options: {
  window: Window;
  frames(): { window: Window; origin: string }[];
  epoch: string;
  store: DisplayStore;
}): () => void;
