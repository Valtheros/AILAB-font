const fallback = "/dashboard";
const origin = "https://callback.invalid";
const appPaths = /^\/(?:$|overview(?:\/|$)|guide(?:\/|$)|annotate(?:\/|$)|dataset(?:\/|$)|tasks(?:\/|$)|dashboard(?:\/|$)|account(?:\/|$)|admin(?:\/|$)|config(?:\/|$)|training(?:\/|$)|results(?:\/|$))/;

export function safeCallbackURL(value: string | null | undefined): string {
  if (!value?.startsWith("/") || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return fallback;
    // Validate decoded paths too; preserve the original query (including transfer IDs).
    let path = url.pathname;
    for (let i = 0; i < 4 && path.includes("%"); i++) path = decodeURIComponent(path);
    if (/[\\%\u0000-\u0020\u007f]/.test(path) || path.startsWith("//")) return fallback;
    const normalized = new URL(path, origin);
    if (normalized.origin !== origin || !appPaths.test(normalized.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function authHref(mode: "login" | "signup", callback: string) {
  return `/${mode}?callbackURL=${encodeURIComponent(safeCallbackURL(callback))}`;
}
