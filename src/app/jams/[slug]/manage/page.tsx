import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { hasPermission } from "@/lib/permissions";
import { jamRoleLabel } from "@/lib/jam-labels";
import { loadJamPage } from "@/lib/jam-page-queries";
import { loadManageSubmissions } from "@/lib/manage-queries";
import { resultsBanner } from "@/lib/manage";
import { cn } from "@/lib/utils";
import { JamHeader } from "../jam-header";
import { RevealResultsButton } from "../results/reveal-button";
import { DeleteJamButton } from "./delete-jam-button";
import { RoleManager } from "./role-manager";
import { SubmissionsTable } from "./submissions-table";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadJamPage(slug, null);
  return { title: data ? `Manage ${data.jam.name}` : "Manage jam" };
}

export default async function ManageJamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/jams/${slug}/manage`)}`);

  const data = await loadJamPage(slug, session.user.id);
  if (!data) notFound();
  const { jam, phase, viewer } = data;
  if (!viewer.canManageRoles && !viewer.canModerate) notFound();

  const canDeleteJam = hasPermission(viewer.roles, "delete_jam");
  const canDeleteSubmissions = hasPermission(viewer.roles, "delete_submission");
  const submissions = viewer.canModerate ? await loadManageSubmissions(jam.id) : null;
  const banner = viewer.canPreviewResults ? resultsBanner({ ...jam, phase }) : null;
  const ratedCriteria = jam.criteria.filter((c) => c.source === "RATED").length;
  const organizerCount = new Set(jam.roles.map((r) => r.userId)).size;

  const side = [
    ...(submissions ? [{ href: "#submissions", label: "Submissions", count: submissions.length }] : []),
    ...(viewer.canManageRoles ? [{ href: "#organizers", label: "Organizers", count: organizerCount }] : []),
    ...(viewer.canEditJam ? [{ href: `/jams/${slug}/edit`, label: "Edit details" }] : []),
    ...(viewer.canEditJam && jam.ranked
      ? [{ href: `/jams/${slug}/edit#rating`, label: "Criteria", count: ratedCriteria }]
      : []),
    ...(canDeleteJam ? [{ href: "#danger", label: "Danger zone", danger: true }] : []),
  ];

  return (
    <>
      <JamHeader data={data} active="manage" />
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-x-10 px-4 pt-7 pb-16 md:px-12 lg:grid-cols-12">
        <nav aria-label="Manage sections" className="sticky top-6 hidden flex-col gap-0.5 lg:col-span-2 lg:flex">
          {side.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className={cn(
                "flex h-8.5 items-center justify-between rounded-md px-3 text-sm hover:bg-muted",
                "danger" in s ? "text-destructive" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
              {"count" in s && <span className="font-mono text-xs text-subtle-foreground">{s.count}</span>}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-8 lg:col-span-10">
          <p className="text-sm text-muted-foreground">
            Your role in this jam:{" "}
            <span className="text-foreground">{viewer.roles.map(jamRoleLabel).join(" · ")}</span>
          </p>

          {banner && (
            <section
              aria-labelledby="results-banner"
              className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-4.5 md:flex-row md:items-center md:gap-5"
            >
              <div className="flex flex-1 flex-col gap-1">
                <h2 id="results-banner" className="text-[15px] font-semibold">
                  {banner.title}
                </h2>
                <p className="text-sm text-muted-foreground">{banner.text}</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/jams/${slug}/results`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-11 px-3.5 md:h-9")}
                >
                  {banner.title === "Results are public" ? "View results" : "Preview"}
                </Link>
                {banner.canReveal && viewer.canEditJam && <RevealResultsButton jamId={jam.id} />}
              </div>
            </section>
          )}

          {submissions && (
            <section id="submissions" aria-labelledby="submissions-title" className="scroll-mt-6">
              <SubmissionsTable rows={submissions} canDelete={canDeleteSubmissions} />
            </section>
          )}

          {viewer.canManageRoles && (
            <section id="organizers" aria-labelledby="organizers-title" className="scroll-mt-6">
              <RoleManager
                jamId={jam.id}
                creatorId={jam.createdById}
                currentUserId={session.user.id}
                roles={jam.roles.map((r) => ({
                  userId: r.userId,
                  role: r.role,
                  user: { username: r.user.username, displayName: r.user.displayName },
                }))}
              />
            </section>
          )}

          {canDeleteJam && (
            <section
              id="danger"
              aria-labelledby="danger-title"
              className="flex scroll-mt-6 flex-col gap-4 rounded-xl border border-destructive/35 px-5 py-4.5 md:flex-row md:items-center"
            >
              <div className="flex flex-1 flex-col gap-1">
                <h2 id="danger-title" className="text-[15px] font-semibold">
                  Delete jam
                </h2>
                <p className="text-sm text-muted-foreground">
                  Removes the jam from public view. Staff can restore it later.
                </p>
              </div>
              <DeleteJamButton jamId={jam.id} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
