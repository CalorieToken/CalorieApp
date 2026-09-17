// Explicit browser-only requests to the official Testnet services. No app proxy,
// analytics, account storage, real-account input or wallet transactions.
export const TESTNET_FAUCET = "https://faucet.altnet.rippletest.net/accounts";
export const TESTNET_LEDGER = "wss://s.altnet.rippletest.net:51233/";
export type TestnetAccount = { address: string; secret: string };
export type TestnetFailure = "limited" | "failed" | "invalidResponse" | "timedOut" | "connectionFailed" | "unsupported";
export class TestnetRequestError extends Error {
  constructor(public code: TestnetFailure) { super(code); }
}
const delayKey = "ctstyle-testnet-delays-v1";
const retryAt = { create: 0, check: 0 };
type RequestKind = keyof typeof retryAt;

export function testnetWait(kind: RequestKind): number {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(delayKey) || "null");
    for (const item of ["create", "check"] as const) {
      if (Number.isSafeInteger(saved?.[item]) && saved[item] > 0) retryAt[item] = Math.max(retryAt[item], saved[item]);
    }
  } catch { /* A blocked store does not bypass the in-memory delay. */ }
  return Math.max(0, Math.ceil((retryAt[kind] - Date.now()) / 1000));
}

function delay(kind: RequestKind, milliseconds: number) {
  retryAt[kind] = Math.max(retryAt[kind], Date.now() + milliseconds);
  try { window.sessionStorage.setItem(delayKey, JSON.stringify(retryAt)); } catch { /* In-memory fallback. */ }
}

export function parseTestnetAccount(value: unknown): TestnetAccount {
  const data = value as { seed?: unknown; account?: { classicAddress?: unknown; address?: unknown; secret?: unknown } } | null;
  const account = data?.account;
  const address = account?.classicAddress || account?.address;
  const hasSeed = !!data && Object.prototype.hasOwnProperty.call(data, "seed");
  const secret = hasSeed ? data.seed : account?.secret;
  if ((hasSeed && account && Object.prototype.hasOwnProperty.call(account, "secret") && account.secret !== secret)
    || typeof address !== "string" || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)
    || typeof secret !== "string" || !/^s[1-9A-HJ-NP-Za-km-z]{20,34}$/.test(secret)) {
    throw new TestnetRequestError("invalidResponse");
  }
  return { address, secret };
}

export async function createTestnetAccount(signal: AbortSignal): Promise<TestnetAccount> {
  if (testnetWait("create")) throw new TestnetRequestError("limited");
  if (typeof window.fetch !== "function" || typeof window.AbortController !== "function") throw new TestnetRequestError("unsupported");
  signal.throwIfAborted();
  delay("create", 60000);
  const request = new AbortController();
  const abort = () => request.abort();
  signal.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timeout = window.setTimeout(() => { timedOut = true; request.abort(); }, 25000);
  try {
    const response = await window.fetch(TESTNET_FAUCET, {
      method: "POST", mode: "cors", credentials: "omit", cache: "no-store",
      redirect: "error", referrerPolicy: "no-referrer", signal: request.signal,
    });
    if (!response.ok) {
      if (response.status === 429 || response.status === 503) {
        const value = (response.headers.get("retry-after") || "").trim();
        const wait = /^\d{1,10}$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
        delay("create", Number.isFinite(wait) ? Math.max(60000, wait) : 60000);
      }
      throw new TestnetRequestError(response.status === 429 ? "limited" : "failed");
    }
    if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw new TestnetRequestError("invalidResponse");
    const value: unknown = await response.json();
    request.signal.throwIfAborted();
    return parseTestnetAccount(value);
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (timedOut) throw new TestnetRequestError("timedOut");
    if (error instanceof TestnetRequestError) throw error;
    throw new TestnetRequestError(error instanceof SyntaxError ? "invalidResponse" : "connectionFailed");
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

export function checkTestnetAccount(address: string, signal: AbortSignal): Promise<boolean> {
  if (testnetWait("check") || signal.aborted) return Promise.resolve(false);
  delay("check", 15000);
  return new Promise(resolve => {
    let socket: WebSocket | undefined;
    let done = false;
    const finish = (ok = false) => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      if (socket) {
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
        try { socket.close(); } catch { /* Already closed. */ }
      }
      resolve(ok);
    };
    const abort = () => finish();
    const timeout = window.setTimeout(finish, 15000);
    signal.addEventListener("abort", abort, { once: true });
    try {
      socket = new window.WebSocket(TESTNET_LEDGER);
      socket.onopen = () => socket?.send(JSON.stringify({ id: 1, command: "account_info", account: address, ledger_index: "validated", strict: true }));
      socket.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.id !== 1) return;
          if (data.warning === "load") delay("check", 60000);
          const result = data.result, info = result?.account_data;
          finish(data.status === "success" && result?.validated === true && info?.Account === address
            && typeof info.Balance === "string" && /^[0-9]{1,18}$/.test(info.Balance) && Number(info.Balance) > 0);
        } catch { finish(); }
      };
      socket.onerror = () => finish();
      socket.onclose = event => { if (event.code === 1008) delay("check", 60000); finish(); };
    } catch { finish(); }
  });
}
