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
