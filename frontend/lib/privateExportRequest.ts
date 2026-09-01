export const PRIVATE_EXPORT_PATH = "api/identity/export";
export const PRIVATE_EXPORT_REQUEST_HEADER = "x-calorieapp-request";
export const PRIVATE_EXPORT_REQUEST_VALUE = "private-export";

type RequestWithHeaders = {
  headers: {
    get(name: string): string | null;
  };
};

export function isTrustedPrivateExportRequest(
  path: string,
  request: RequestWithHeaders
): boolean {
  if (path !== PRIVATE_EXPORT_PATH) {
    return true;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    (!fetchSite || fetchSite === "same-origin") &&
    request.headers.get(PRIVATE_EXPORT_REQUEST_HEADER) ===
      PRIVATE_EXPORT_REQUEST_VALUE
  );
}
