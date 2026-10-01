import { describe, it, expect } from "vitest";
import { displayItchUrl, submitChecklist, type SubmitChecklistInput } from "@/lib/submission-form";

const base: SubmitChecklistInput = {
  title: "Cinder Garden",
  description: "",
  platforms: 0,
  coverUrl: "",
  hasItchUrl: true,
  verified: true,
  missingRequiredFields: [],
  hasRequiredFields: false,
};

describe("submitChecklist", () => {
  it("is ready with a title and a verified page, recommendations aside", () => {
    const res = submitChecklist(base);
    expect(res.ready).toBe(true);
    expect(res.checks.map((c) => [c.key, c.state])).toEqual([
      ["title", "done"],
      ["itch", "done"],
      ["description", "optional"],
      ["platforms", "optional"],
      ["cover", "optional"],
    ]);
  });

  it("blocks on an unverified or missing link", () => {
    expect(submitChecklist({ ...base, verified: false }).checks[1]).toMatchObject({ state: "todo", hint: "Check your page" });
    const missing = submitChecklist({ ...base, hasItchUrl: false, verified: false });
    expect(missing.ready).toBe(false);
    expect(missing.checks[1].hint).toBe("Add and save your itch.io link");
  });

  it("lists missing required questions", () => {
    const res = submitChecklist({ ...base, hasRequiredFields: true, missingRequiredFields: ["Engine"] });
    expect(res.ready).toBe(false);
    expect(res.checks.find((c) => c.key === "questions")).toMatchObject({ state: "todo", hint: "Missing: Engine" });
  });
});

describe("displayItchUrl", () => {
  it("drops the scheme and trailing slash", () => {
    expect(displayItchUrl("https://mira.itch.io/cinder-garden/")).toBe("mira.itch.io/cinder-garden");
  });
});
