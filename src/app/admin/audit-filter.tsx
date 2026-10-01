"use client";

import { useRouter } from "next/navigation";
import { auditHref, type AuditFilter } from "@/lib/admin";

// The filter is part of the URL, so the server renders the matching page.
export function AuditFilterSelect({
  value,
  options,
}: {
  value: AuditFilter;
  options: { value: AuditFilter; label: string }[];
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Filter by action"
      value={value}
      onChange={(e) => router.push(auditHref(e.target.value as AuditFilter, 1))}
      className="h-11 rounded-lg border border-input bg-card px-2 text-[13px] md:h-8.5"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
