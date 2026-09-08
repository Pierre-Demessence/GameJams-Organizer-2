import { describe, it, expect } from "vitest";
import {
  isItchProjectUrl,
  submissionSchema,
  criterionSchema,
  findMissingRequiredFields,
} from "@/lib/validations";

describe("isItchProjectUrl", () => {
  it("accepts itch.io and *.itch.io over HTTPS", () => {
    expect(isItchProjectUrl("https://itch.io/jam")).toBe(true);
    expect(isItchProjectUrl("https://alice.itch.io/my-game")).toBe(true);
  });

  it("rejects non-HTTPS", () => {
    expect(isItchProjectUrl("http://alice.itch.io/my-game")).toBe(false);
  });

  it("rejects other hosts and lookalikes", () => {
    expect(isItchProjectUrl("https://evil.com")).toBe(false);
    expect(isItchProjectUrl("https://itch.io.evil.com/x")).toBe(false);
    expect(isItchProjectUrl("https://itch.io@evil.com/x")).toBe(false);
    expect(isItchProjectUrl("not a url")).toBe(false);
  });
});

describe("criterionSchema", () => {
  it("defaults source to RATED and isPrimary to false", () => {
    const parsed = criterionSchema.parse({ name: "Fun" });
    expect(parsed.source).toBe("RATED");
    expect(parsed.isPrimary).toBe(false);
    expect(parsed.weight).toBe(1);
  });
});

describe("submissionSchema", () => {
  it("accepts a valid itch.io URL", () => {
    const parsed = submissionSchema.parse({
      title: "My Game",
      itchUrl: "https://alice.itch.io/my-game",
      supportedPlatforms: ["WEB"],
    });
    expect(parsed.itchUrl).toBe("https://alice.itch.io/my-game");
  });

  it("rejects a non-itch.io URL", () => {
    const result = submissionSchema.safeParse({
      title: "My Game",
      itchUrl: "https://example.com/my-game",
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty itch.io URL (draft in progress)", () => {
    const result = submissionSchema.safeParse({ title: "My Game", itchUrl: "" });
    expect(result.success).toBe(true);
  });
});

describe("findMissingRequiredFields", () => {
  it("returns names of required fields with empty or whitespace values", () => {
    const missing = findMissingRequiredFields([
      { name: "Repo", required: true, value: "" },
      { name: "Notes", required: true, value: "   " },
      { name: "Trailer", required: true, value: null },
      { name: "Contact", required: true, value: undefined },
    ]);
    expect(missing).toEqual(["Repo", "Notes", "Trailer", "Contact"]);
  });

  it("ignores optional fields and filled required fields", () => {
    const missing = findMissingRequiredFields([
      { name: "Repo", required: true, value: "https://github.com/x" },
      { name: "Notes", required: false, value: "" },
    ]);
    expect(missing).toEqual([]);
  });
});
