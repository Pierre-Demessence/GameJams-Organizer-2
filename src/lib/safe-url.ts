// Stored URLs are only validated as well-formed, which accepts javascript: and data: schemes.
// Anything rendered into href/src goes through this first.
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

const PROBE_ORIGIN = "http://callback.invalid";

// Post-sign-in redirects must stay on this site. Resolving against a probe origin catches
// everything a browser treats as another origin (`https://…`, `//host`, `/\host`, and the
// tab/newline variants URL parsing strips); anything else falls back to the homepage.
export function safeCallbackPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  try {
    const url = new URL(value, PROBE_ORIGIN);
    return url.origin === PROBE_ORIGIN ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
