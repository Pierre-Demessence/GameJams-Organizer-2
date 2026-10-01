import { describe, it, expect } from "vitest";
import { safeCallbackPath, safeHttpUrl } from "@/lib/safe-url";

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

describe("safeCallbackPath", () => {
  it("keeps same-site paths", () => {
    expect(safeCallbackPath("/jams/x?tab=1#top")).toBe("/jams/x?tab=1#top");
    // Encoded characters stay a path segment on this site.
    expect(safeCallbackPath("/%09/evil.example")).toBe("/%09/evil.example");
  });

  it("rejects other origins and empty values", () => {
    const attacks = [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "javascript:alert(1)",
      "",
      null,
    ];
    for (const v of attacks) {
      expect(safeCallbackPath(v)).toBe("/");
    }
  });
});
