import { describe, it, expect } from "vitest";
import { auditActionWhere, auditHref, auditTone, deletedJamSlug, parseAuditParams, restoredSlug } from "@/lib/admin";

describe("jam slugs", () => {
  it("round-trips the deleted slug", () => {
    expect(restoredSlug(deletedJamSlug("pixel-jam", "c1"), "c1")).toBe("pixel-jam");
    expect(restoredSlug("pixel-jam", "c1")).toBe("pixel-jam");
    expect(restoredSlug(deletedJamSlug("pixel-jam", "c1"), "other")).toBe("pixel-jam__del__c1");
  });
});

describe("audit filters", () => {
  it("parses and clamps params", () => {
    expect(parseAuditParams({})).toEqual({ filter: "all", page: 1 });
    expect(parseAuditParams({ action: "deletes", page: "3" })).toEqual({ filter: "deletes", page: 3 });
    expect(parseAuditParams({ action: "drop table", page: "-4" })).toEqual({ filter: "all", page: 1 });
  });

  it("maps filters to action conditions and links", () => {
    expect(auditActionWhere("restores")).toEqual({ action: { endsWith: ":restore" } });
    expect(auditActionWhere("all")).toEqual({});
    expect(auditHref("all", 1)).toBe("/admin#audit");
    expect(auditHref("staff", 2)).toBe("/admin?action=staff&page=2#audit");
  });

  it("colors destructive and restoring actions", () => {
    expect(auditTone("jam:soft_delete")).toBe("danger");
    expect(auditTone("submission:restore")).toBe("live");
    expect(auditTone("jam:edit")).toBe("muted");
  });
});
