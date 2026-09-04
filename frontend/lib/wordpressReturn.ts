const DEFAULT_WORDPRESS_APP_URL =
  "https://calorietoken.net/index.php/calorieapp/";
const WORDPRESS_APP_URL =
  process.env.NEXT_PUBLIC_WORDPRESS_APP_URL?.trim() ||
  DEFAULT_WORDPRESS_APP_URL;

export function safeWordPressReturn(value: unknown): string {
  const candidates = [
    typeof value === "string" ? value : "",
    WORDPRESS_APP_URL,
    DEFAULT_WORDPRESS_APP_URL,
  ];

  for (const candidate of candidates) {
    try {
      const target = new URL(candidate);
      if (
        target.protocol === "https:" &&
        ["calorietoken.net", "www.calorietoken.net"].includes(
          target.hostname
        ) &&
        (target.port === "" || target.port === "443") &&
        !target.username &&
        !target.password &&
        target.search === "" &&
        target.hash === ""
      ) {
        return target.toString();
      }
    } catch {
      // Try the next trusted fallback.
    }
  }

  return DEFAULT_WORDPRESS_APP_URL;
}
