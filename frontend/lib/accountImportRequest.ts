export const ACCOUNT_IMPORT_PATH = "api/identity/import";
export const ACCOUNT_IMPORT_REQUEST_HEADER = "x-calorieapp-request";
export const ACCOUNT_IMPORT_REQUEST_VALUE = "account-import";
export const ACCOUNT_IMPORT_SOURCE_HEADER =
  "x-calorieapp-import-source-account";
export const ACCOUNT_IMPORT_TARGET_HEADER =
  "x-calorieapp-import-target-account";
export const ACCOUNT_IMPORT_ACKNOWLEDGEMENT_HEADER =
  "x-calorieapp-import-acknowledgement";
export const ACCOUNT_IMPORT_ACKNOWLEDGEMENT = "import-private-food-history";

type RequestWithHeaders = {
  headers: {
    get(name: string): string | null;
  };
};

export function isTrustedAccountImportRequest(
  path: string,
  request: RequestWithHeaders
): boolean {
  if (path !== ACCOUNT_IMPORT_PATH) {
    return true;
  }

  return (
    request.headers.get("sec-fetch-site") === "same-origin" &&
    request.headers.get(ACCOUNT_IMPORT_REQUEST_HEADER) ===
      ACCOUNT_IMPORT_REQUEST_VALUE
  );
}
