// softDeleteJamAction frees the slug by renaming it to `<slug>__del__<id>`.
const DELETED_SUFFIX = "__del__";

export function deletedJamSlug(slug: string, id: string): string {
  return `${slug}${DELETED_SUFFIX}${id}`;
}

export function restoredSlug(slug: string, id: string): string {
  const suffix = `${DELETED_SUFFIX}${id}`;
  return slug.endsWith(suffix) ? slug.slice(0, -suffix.length) : slug;
}

export type AuditFilter = "all" | "deletes" | "restores" | "staff";
export const AUDIT_FILTERS: { value: AuditFilter; label: string }[] = [
  { value: "all", label: "All actions" },
  { value: "deletes", label: "Deletes" },
  { value: "restores", label: "Restores" },
  { value: "staff", label: "Role changes" },
];

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseAuditParams(raw: Raw): { filter: AuditFilter; page: number } {
  const f = first(raw.action);
  const filter = AUDIT_FILTERS.some((x) => x.value === f) ? (f as AuditFilter) : "all";
  const page = Math.min(10_000, Math.max(1, Math.floor(Number(first(raw.page))) || 1));
  return { filter, page };
}

// Actions follow the "namespace:verb" convention of recordAudit().
export function auditActionWhere(filter: AuditFilter): { action?: { endsWith?: string; startsWith?: string } } {
  switch (filter) {
    case "deletes":
      return { action: { endsWith: ":soft_delete" } };
    case "restores":
      return { action: { endsWith: ":restore" } };
    case "staff":
      return { action: { startsWith: "staff:" } };
    case "all":
      return {};
  }
}

export function auditHref(filter: AuditFilter, page: number): string {
  const parts = [filter !== "all" && `action=${filter}`, page > 1 && `page=${page}`].filter(Boolean);
  return `/admin${parts.length ? `?${parts.join("&")}` : ""}#audit`;
}

export function auditTone(action: string): "danger" | "live" | "muted" {
  if (action.endsWith(":soft_delete") || action.endsWith(":revoke")) return "danger";
  if (action.endsWith(":restore") || action.endsWith(":grant")) return "live";
  return "muted";
}
