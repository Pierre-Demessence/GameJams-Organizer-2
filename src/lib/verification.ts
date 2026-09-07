import { randomBytes } from "crypto";
import { isItchProjectUrl } from "@/lib/validations";

// itch.io ownership verification: fetch the project page and confirm a
// per-submission code is present. Fetching is restricted to itch.io hosts.

const FETCH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

export function generateVerificationCode(): string {
  return `gjo-verify-${randomBytes(9).toString("hex")}`;
}

// Single-host allowlist (itch.io and *.itch.io) over HTTPS. Redirects are
// re-validated per hop (see verifyCodeOnItchPage). Broader SSRF safeguards
// (private-range blocking) are deferred until arbitrary hosts are supported —
// the MVP only ever fetches itch.io.
export function allowedItchUrl(raw: string): URL | null {
  if (!isItchProjectUrl(raw)) return null;
  return new URL(raw);
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

// Returns true when the code is present on the linked itch.io page. Redirects
// are followed manually and each hop is re-validated against the allowlist, so
// an itch.io page cannot bounce the fetch to an arbitrary host.
export async function verifyCodeOnItchPage(
  rawUrl: string,
  code: string
): Promise<boolean> {
  let current = allowedItchUrl(rawUrl);
  if (!current) return false;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "user-agent": "GameJamsOrganizer/1.0 (+verification)" },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return false;
        const next = allowedItchUrl(new URL(location, current).toString());
        if (!next) return false;
        current = next;
        continue;
      }

      if (!res.ok) return false;
      const body = await readCapped(res);
      return body.includes(code);
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
  return false;
}
