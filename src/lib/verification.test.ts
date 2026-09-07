import { describe, it, expect, vi, afterEach } from "vitest";
import { allowedItchUrl, verifyCodeOnItchPage } from "@/lib/verification";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("allowedItchUrl", () => {
  it("accepts itch.io hosts over HTTPS", () => {
    expect(allowedItchUrl("https://alice.itch.io/game")?.hostname).toBe(
      "alice.itch.io"
    );
  });

  it("rejects disallowed hosts and schemes", () => {
    expect(allowedItchUrl("https://evil.com")).toBeNull();
    expect(allowedItchUrl("http://alice.itch.io/game")).toBeNull();
  });
});

describe("verifyCodeOnItchPage", () => {
  it("returns true when the code is on the page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>code: gjo-verify-abc</html>"))
    );
    const ok = await verifyCodeOnItchPage(
      "https://alice.itch.io/game",
      "gjo-verify-abc"
    );
    expect(ok).toBe(true);
  });

  it("returns false when the code is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>nothing here</html>"))
    );
    const ok = await verifyCodeOnItchPage(
      "https://alice.itch.io/game",
      "gjo-verify-abc"
    );
    expect(ok).toBe(false);
  });

  it("refuses to follow a redirect off the itch.io allowlist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://evil.com/steal" },
          })
      )
    );
    const ok = await verifyCodeOnItchPage(
      "https://alice.itch.io/game",
      "gjo-verify-abc"
    );
    expect(ok).toBe(false);
  });

  it("follows an in-allowlist redirect and finds the code", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://alice.itch.io/game-v2" },
        })
      )
      .mockResolvedValueOnce(new Response("code: gjo-verify-abc"));
    vi.stubGlobal("fetch", fetchMock);

    const ok = await verifyCodeOnItchPage(
      "https://alice.itch.io/game",
      "gjo-verify-abc"
    );
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a non-itch.io starting URL without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const ok = await verifyCodeOnItchPage("https://evil.com", "x");
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
