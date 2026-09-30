import { describe, it, expect } from "vitest";
import { safeHttpUrl } from "@/lib/safe-url";

describe("safeHttpUrl", () => {
  it("keeps http and https URLs", () => {
    expect(safeHttpUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com");
  });
  it("rejects other schemes and garbage", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,x")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});
