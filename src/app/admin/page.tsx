import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkStaffPermission } from "@/lib/staff-permissions";
import { buttonVariants } from "@/components/ui/button-variants";
import { AUDIT_FILTERS, auditActionWhere, auditHref, auditTone, parseAuditParams } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { AuditFilterSelect } from "./audit-filter";
import { RestoreButton } from "./restore-button";
import { StaffManager } from "./staff-manager";

export const metadata = { title: "Platform admin" };

const PAGE_SIZE = 50;
const STAMP = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});
const TONE = { danger: "text-destructive", live: "text-live", muted: "text-muted-foreground" } as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=%2Fadmin");
  if (!(await checkStaffPermission(session.user.id, "view_audit_log"))) notFound();

  const { filter, page } = parseAuditParams(await searchParams);
  const auditWhere = auditActionWhere(filter);

  const [auditEntries, auditCount, deletedJams, deletedSubmissions, staffRoles] = await Promise.all([
    db.auditLogEntry.findMany({
      where: auditWhere,
      include: { actor: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLogEntry.count({ where: auditWhere }),
    // Naming deletedAt in the where bypasses the soft-delete read filter.
    db.jam.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    }),
    db.submission.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true, jam: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
    }),
    db.staffRole.findMany({
      where: { role: "SITE_ADMIN" },
      include: { user: { select: { id: true, username: true, displayName: true } } },
    }),
  ]);

  const deletedIds = [...deletedJams.map((j) => j.id), ...deletedSubmissions.map((s) => s.id)];
  // Staff deletions are audited; organizer deletions are not, so "Deleted by" falls back.
  const deleters = await db.auditLogEntry.findMany({
    where: { targetId: { in: deletedIds }, action: { endsWith: ":soft_delete" } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, createdAt: true, actor: { select: { username: true } } },
  });
  const deletedAt = new Map([...deletedJams, ...deletedSubmissions].map((d) => [d.id, d.deletedAt!.getTime()]));
  const deletedBy = new Map<string, string>();
  for (const d of deleters) {
    // Only the entry written by the current deletion counts: an older staff delete that was
    // restored must not be credited for a later, unaudited organizer delete.
    const at = d.targetId ? deletedAt.get(d.targetId) : undefined;
    if (d.targetId && at !== undefined && Math.abs(d.createdAt.getTime() - at) < 60_000 && !deletedBy.has(d.targetId)) {
      deletedBy.set(d.targetId, d.actor.username);
    }
  }

  const deleted = [
    ...deletedJams.map((j) => ({ kind: "jam" as const, id: j.id, item: j.name, ctx: null, at: j.deletedAt! })),
    ...deletedSubmissions.map((s) => ({
      kind: "submission" as const,
      id: s.id,
      item: s.title,
      ctx: `in ${s.jam.name}`,
      at: s.deletedAt!,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const totalPages = Math.max(1, Math.ceil(auditCount / PAGE_SIZE));
  const staff = staffRoles.map((r) => ({
    userId: r.user.id,
    username: r.user.username,
    displayName: r.user.displayName,
  }));
  const side = [
    { id: "deleted", label: "Deleted", count: deleted.length },
    { id: "audit", label: "Audit log" },
    { id: "staff", label: "Staff", count: staff.length },
  ];

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-x-10 px-4 pt-6 pb-16 md:px-12 md:pt-9 lg:grid-cols-12">
      <nav aria-label="Admin sections" className="sticky top-6 hidden flex-col gap-0.5 pt-19 lg:col-span-2 lg:flex">
        {side.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex h-8.5 items-center justify-between rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {s.label}
            {s.count !== undefined && <span className="font-mono text-xs text-subtle-foreground">{s.count}</span>}
          </a>
        ))}
      </nav>

      <div className="flex min-w-0 flex-col gap-8 lg:col-span-10">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] font-semibold tracking-tight">Platform admin</h1>
          <p className="text-muted-foreground">Staff actions here are recorded in the audit log.</p>
        </div>

        <section id="deleted" aria-labelledby="deleted-title" className="flex scroll-mt-6 flex-col gap-3.5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 id="deleted-title" className="flex-1 text-lg font-semibold">
              Deleted content
            </h2>
            <span className="text-[13px] text-subtle-foreground">Soft-deleted: restorable by any Site Admin</span>
          </div>
          {deleted.length === 0 ? (
            <p className="rounded-xl border py-8 text-center text-sm text-muted-foreground">Nothing deleted.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="hidden md:table-header-group">
                <tr className="text-left text-xs text-subtle-foreground">
                  <th scope="col" className="w-27.5 border-b pb-2.5 font-medium">Type</th>
                  <th scope="col" className="border-b pb-2.5 font-medium">Item</th>
                  <th scope="col" className="w-37.5 border-b pb-2.5 font-medium">Deleted by</th>
                  <th scope="col" className="w-37.5 border-b pb-2.5 font-medium">When (UTC)</th>
                  <th scope="col" className="w-25 border-b pb-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {deleted.map((d) => (
                  <tr key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-3 md:table-row md:py-0">
                    <td className="md:border-b md:py-3">
                      <span className="inline-flex h-5.5 items-center rounded-md border border-input px-2 text-xs font-medium text-muted-foreground">
                        {d.kind === "jam" ? "Jam" : "Submission"}
                      </span>
                    </td>
                    <td className="min-w-0 flex-1 md:border-b md:py-3 md:pr-3">
                      <span className="font-medium">{d.item}</span>{" "}
                      {d.ctx && <span className="text-subtle-foreground">{d.ctx}</span>}
                    </td>
                    <td className="w-full text-muted-foreground md:w-auto md:border-b md:py-3">
                      {deletedBy.get(d.id) ?? "Organizers"}
                    </td>
                    <td className="font-mono text-xs text-subtle-foreground md:border-b md:py-3">{STAMP.format(d.at)}</td>
                    <td className="ml-auto text-right md:border-b md:py-3">
                      <RestoreButton kind={d.kind} id={d.id} label={d.item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section id="audit" aria-labelledby="audit-title" className="flex scroll-mt-6 flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <h2 id="audit-title" className="flex-1 text-lg font-semibold">
              Audit log
            </h2>
            <AuditFilterSelect value={filter} options={AUDIT_FILTERS} />
          </div>
          {auditEntries.length === 0 ? (
            <p className="rounded-xl border py-8 text-center text-sm text-muted-foreground">No entries.</p>
          ) : (
            <ol className="overflow-hidden rounded-xl border">
              {auditEntries.map((e, i) => {
                const meta = (e.metadata ?? {}) as Record<string, unknown>;
                const target =
                  [meta.name, meta.title, meta.username].find((v): v is string => typeof v === "string") ??
                  `${e.targetType} ${e.targetId ?? ""}`.trim();
                return (
                  <li
                    key={e.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-4 gap-y-0.5 px-4 py-2.75 text-sm",
                      i < auditEntries.length - 1 && "border-b"
                    )}
                  >
                    <span className="w-32.5 shrink-0 font-mono text-xs text-subtle-foreground">
                      {STAMP.format(e.createdAt)}
                    </span>
                    <span className="w-27.5 shrink-0 truncate text-muted-foreground">{e.actor.username}</span>
                    <span className={cn("w-37.5 shrink-0 font-mono text-xs", TONE[auditTone(e.action)])}>{e.action}</span>
                    <span className="min-w-0 flex-1 truncate">{target}</span>
                  </li>
                );
              })}
            </ol>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-[13px] text-subtle-foreground">
              {page > 1 && (
                <Link href={auditHref(filter, page - 1)} className={cn(buttonVariants({ variant: "outline" }), "h-11 md:h-8.5")}>
                  Newer entries
                </Link>
              )}
              <span>
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link href={auditHref(filter, page + 1)} className={cn(buttonVariants({ variant: "outline" }), "h-11 md:h-8.5")}>
                  Older entries
                </Link>
              )}
            </div>
          )}
        </section>

        <section id="staff" aria-labelledby="staff-title" className="flex scroll-mt-6 flex-col gap-3.5">
          <h2 id="staff-title" className="text-lg font-semibold">
            Staff
          </h2>
          <StaffManager staff={staff} currentUserId={session.user.id} />
        </section>
      </div>
    </div>
  );
}
