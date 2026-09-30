import { describe, it, expect } from "vitest";
import {
  JAM_LIST_MAX,
  JAM_LIST_PAGE_SIZE,
  jamListHref,
  parseJamListParams,
  topTags,
} from "@/lib/jam-list-params";

const defaults = {
  status: "all",
  q: "",
  tag: "",
  format: "any",
  sort: "relevant",
  show: JAM_LIST_PAGE_SIZE,
};

describe("parseJamListParams", () => {
  it("returns defaults for an empty query", () => {
    expect(parseJamListParams({})).toEqual(defaults);
  });
  it("reads valid values", () => {
    expect(
      parseJamListParams({ status: "live", q: " pixel ", tag: "2D", format: "ranked", sort: "joined", show: "48" })
    ).toEqual({ status: "live", q: "pixel", tag: "2D", format: "ranked", sort: "joined", show: 48 });
  });
  it("falls back on unknown or hostile values", () => {
    const parsed = parseJamListParams({
      status: "nope",
      format: "x",
      sort: "drop table",
      show: "99999",
      q: "a".repeat(5000),
      tag: ["a", "b"],
    });
    expect(parsed.status).toBe("all");
    expect(parsed.format).toBe("any");
    expect(parsed.sort).toBe("relevant");
    expect(parsed.show).toBe(JAM_LIST_MAX);
    expect(parsed.q).toHaveLength(100);
    expect(parsed.tag).toBe("a");
  });
  it("rounds show up to a whole page and never below one page", () => {
    expect(parseJamListParams({ show: "25" }).show).toBe(48);
    expect(parseJamListParams({ show: "-3" }).show).toBe(JAM_LIST_PAGE_SIZE);
    expect(parseJamListParams({ show: "abc" }).show).toBe(JAM_LIST_PAGE_SIZE);
  });
});

describe("jamListHref", () => {
  it("omits defaults", () => {
    expect(jamListHref(parseJamListParams({}))).toBe("/jams");
  });
  it("applies changes and resets paging when filters change", () => {
    const current = parseJamListParams({ status: "live", show: "48", q: "cozy" });
    expect(jamListHref(current, { status: "finished" })).toBe("/jams?status=finished&q=cozy");
    expect(jamListHref(current, { show: 72 })).toBe("/jams?status=live&q=cozy&show=72");
  });
  it("encodes values", () => {
    expect(jamListHref(parseJamListParams({}), { tag: "Pixel art" })).toBe("/jams?tag=Pixel+art");
  });
});

describe("topTags", () => {
  it("orders by frequency, then alphabetically, and limits the count", () => {
    expect(topTags([["2D", "Cozy"], ["2D"], ["Horror", "Cozy"], ["3D"]], 3)).toEqual(["2D", "Cozy", "3D"]);
  });
  it("ignores blanks", () => {
    expect(topTags([["", " "], ["Audio"]])).toEqual(["Audio"]);
  });
});
