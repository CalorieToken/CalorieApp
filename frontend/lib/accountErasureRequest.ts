export const ACCOUNT_ERASURE_PATH = "api/identity/account";
export const ACCOUNT_ERASURE_REQUEST_HEADER = "x-calorieapp-request";
export const ACCOUNT_ERASURE_REQUEST_VALUE = "account-erasure";

type RequestWithHeaders = {
  headers: {
    get(name: string): string | null;
  };
};

export function isTrustedAccountErasureRequest(
  path: string,
  request: RequestWithHeaders
): boolean {
  if (path !== ACCOUNT_ERASURE_PATH) {
    return true;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    (!fetchSite || fetchSite === "same-origin") &&
    request.headers.get(ACCOUNT_ERASURE_REQUEST_HEADER) ===
      ACCOUNT_ERASURE_REQUEST_VALUE
  );
}
