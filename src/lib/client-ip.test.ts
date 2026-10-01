import { describe, it, expect } from "vitest";
import { clientIp } from "@/lib/client-ip";

const h = (values: Record<string, string>) => ({ get: (k: string) => values[k] ?? null });

describe("clientIp", () => {
  it("trusts only the hop the proxy appended", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then a shared bucket", () => {
    expect(clientIp(h({ "x-forwarded-for": " , ", "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
