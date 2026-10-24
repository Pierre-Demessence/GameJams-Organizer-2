// In-memory stand-in for the `cookies()` store of next/headers: one jar acts as "the browser".
// setup.ts resets it before each test.
export interface StoredCookie {
  value: string;
  options: Record<string, unknown>;
}

const store = new Map<string, StoredCookie>();

export const cookieJar = {
  get(name: string): { name: string; value: string } | undefined {
    const stored = store.get(name);
    return stored ? { name, value: stored.value } : undefined;
  },
  set(name: string, value: string, options: Record<string, unknown> = {}): void {
    store.set(name, { value, options });
  },
  delete(name: string): void {
    store.delete(name);
  },
};

export function cookieEntry(name: string): StoredCookie | undefined {
  return store.get(name);
}

export function clearCookies(): void {
  store.clear();
}
