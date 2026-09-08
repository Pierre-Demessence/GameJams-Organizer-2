import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkStaffPermission } from "@/lib/staff-permissions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { StaffManager } from "./staff-manager";

export const metadata = { title: "Platform Admin" };

const PAGE_SIZE = 50;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (!(await checkStaffPermission(session.user.id, "view_audit_log"))) {
    notFound();
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [auditEntries, auditCount, deletedJams, deletedSubmissions, staffRoles] =
    await Promise.all([
      db.auditLogEntry.findMany({
        include: { actor: { select: { username: true, displayName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.auditLogEntry.count(),
      db.jam.findMany({
        where: { deletedAt: { not: null } },
        select: { id: true, name: true, deletedAt: true },
        orderBy: { deletedAt: "desc" },
      }),
      db.submission.findMany({
        where: { deletedAt: { not: null } },
        select: {
          id: true,
          title: true,
          deletedAt: true,
          jam: { select: { name: true } },
        },
        orderBy: { deletedAt: "desc" },
      }),
      db.staffRole.findMany({
        where: { role: "SITE_ADMIN" },
        include: { user: { select: { id: true, username: true, displayName: true } } },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(auditCount / PAGE_SIZE));
  const staff = staffRoles.map((r) => ({
    userId: r.user.id,
    username: r.user.username,
    displayName: r.user.displayName,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold">Platform Admin</h1>

      <Card>
        <CardHeader>
          <CardTitle>Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffManager staff={staff} currentUserId={session.user.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Soft-deleted content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-semibold">Jams</h3>
            {deletedJams.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {deletedJams.map((j) => (
                  <li key={j.id} className="flex justify-between px-3 py-2">
                    <span>{j.name}</span>
                    <span className="text-muted-foreground">
                      {j.deletedAt?.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Submissions</h3>
            {deletedSubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {deletedSubmissions.map((s) => (
                  <li key={s.id} className="flex justify-between px-3 py-2">
                    <span>
                      {s.title}{" "}
                      <span className="text-muted-foreground">— {s.jam.name}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {s.deletedAt?.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
        </CardHeader>
        <CardContent>
          {auditEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {auditEntries.map((e) => (
                <li key={e.id} className="px-3 py-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{e.action}</span>
                    <span className="text-muted-foreground">
                      {e.createdAt.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    by {e.actor.displayName ?? e.actor.username} · {e.targetType}
                    {e.targetId ? ` ${e.targetId}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link
                  href={`/admin?page=${page - 1}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={`/admin?page=${page + 1}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
