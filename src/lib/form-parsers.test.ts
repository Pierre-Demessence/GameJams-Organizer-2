import { describe, it, expect } from "vitest";
import {
  parseJamForm,
  parseSubmissionForm,
  readCustomFieldValues,
} from "@/lib/form-parsers";

function form(entries: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

describe("parseJamForm", () => {
  const minimal = {
    name: "Jam",
    slug: "my-jam",
    shortDesc: "Short",
    fullDesc: "Full",
  };

  it("coerces flags, tags and team size, and drops empty optionals", () => {
    const parsed = parseJamForm(
      form({
        ...minimal,
        ranked: "true",
        hideResults: "false",
        tags: " retro, , pixel ",
        maxTeamSize: "4",
        startDate: "",
        coverUrl: "",
      })
    );
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      ranked: true,
      hideResults: false,
      tags: ["retro", "pixel"],
      maxTeamSize: 4,
    });
    expect(parsed.data?.startDate).toBeUndefined();
    expect(parsed.data?.coverUrl).toBeUndefined();
  });

  it("reports schema errors", () => {
    expect(parseJamForm(form({ ...minimal, slug: "X" })).success).toBe(false);
  });
});

describe("parseSubmissionForm", () => {
  it("collects platforms and screenshots", () => {
    const parsed = parseSubmissionForm(
      form({
        title: "Game",
        platforms: ["WINDOWS", "WEB"],
        screenshots: "https://a.test/1.png, https://a.test/2.png",
        itchUrl: "",
      })
    );
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      supportedPlatforms: ["WINDOWS", "WEB"],
      screenshots: ["https://a.test/1.png", "https://a.test/2.png"],
    });
    expect(parsed.data?.itchUrl).toBeUndefined();
  });

  it("rejects non-itch.io game links", () => {
    expect(
      parseSubmissionForm(form({ title: "Game", itchUrl: "https://evil.test/game" })).success
    ).toBe(false);
  });
});

describe("readCustomFieldValues", () => {
  it("reads custom_<id> inputs, trimming and defaulting to empty", () => {
    const values = readCustomFieldValues(form({ custom_f1: "  Godot  " }), [
      { id: "f1" },
      { id: "f2" },
    ]);
    expect(values).toEqual({ f1: "Godot", f2: "" });
  });
});
