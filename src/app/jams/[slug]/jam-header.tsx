import Link from "next/link";
import { Check } from "lucide-react";
import { CoverImage } from "@/components/cover-image";
import { JamStatusBadge } from "@/components/jam/jam-status-badge";
import { JamTimeline } from "@/components/jam/jam-timeline";
import { LinkTabs, type LinkTab } from "@/components/link-tabs";
import { buttonVariants } from "@/components/ui/button-variants";
import { initials } from "@/lib/initials";
import { entryPanelState } from "@/lib/jam-page";
import type { JamPageData } from "@/lib/jam-page-queries";
import { cn } from "@/lib/utils";
import { JoinJamButton, PublishJamButton } from "./jam-actions-client";

const ACTION = "h-10 min-h-11 w-full px-4 md:w-auto md:min-h-10";

export function JamHeader({
  data,
  active,
}: {
  data: JamPageData;
  active: "overview" | "submissions" | "results" | "manage";
}) {
  const { jam, phase, viewer } = data;
  const base = `/jams/${jam.slug}`;
  const entry = entryPanelState({
    signedIn: Boolean(viewer.userId),
    phase,
    hasJoined: viewer.hasJoined,
    submission: viewer.submission,
  });

  const tabs: LinkTab[] = [
    { href: base, label: "Overview", active: active === "overview" },
    {
      href: `${base}/submissions`,
      label: "Submissions",
      count: jam._count.submissions,
      active: active === "submissions",
    },
  ];
  if (data.resultsVisible) {
    tabs.push({ href: `${base}/results`, label: "Results", active: active === "results" });
  }
  if (viewer.canManageRoles || viewer.canModerate) {
    tabs.push({ href: `${base}/manage`, label: "Manage", active: active === "manage", end: true });
  }

  return (
    <header>
      <CoverImage
        src={jam.coverUrl}
        alt=""
        name={jam.name}
        className="h-36 w-full border-b md:h-56"
      />
      <div className="mx-auto max-w-7xl px-4 md:px-12">
        <div className="-mt-8 flex flex-col gap-4 pb-6 md:-mt-11 md:flex-row md:items-end md:gap-6">
          <div
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl border bg-card text-xl font-semibold md:size-22 md:text-3xl"
          >
            {initials(jam.name)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <nav aria-label="Breadcrumb" className="text-sm text-subtle-foreground">
              <Link href="/jams" className="inline-flex min-h-11 items-center hover:text-foreground md:min-h-0">
                Jams
              </Link>{" "}
              / {jam.slug}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{jam.name}</h1>
              <JamStatusBadge phase={phase} />
              {jam.visibility === "UNLISTED" && (
                <span className="inline-flex h-6 items-center rounded-full border px-2.5 text-xs text-muted-foreground">
                  Unlisted
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{jam.shortDesc}</p>
            {jam.hashtag && <p className="text-sm text-subtle-foreground">{jam.hashtag}</p>}
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {viewer.canEditJam && phase === "DRAFT" && (
              <PublishJamButton jamId={jam.id} className="w-full md:w-auto" />
            )}
            {viewer.canEditJam && (
              <Link href={`${base}/edit`} className={cn(buttonVariants({ variant: "outline" }), ACTION)}>
                Edit
              </Link>
            )}
            {entry.kind === "can-join" && <JoinJamButton jamId={jam.id} className="w-full md:w-auto" />}
            {entry.kind === "joined" && entry.canCreate && (
              <Link href={`${base}/submissions/new`} className={cn(buttonVariants(), ACTION)}>
                Create submission
              </Link>
            )}
            {entry.kind === "has-entry" && (
              <Link
                href={`/submissions/${entry.submissionId}`}
                className={cn(buttonVariants({ variant: "outline" }), ACTION)}
              >
                Your submission
              </Link>
            )}
            {entry.kind === "joined" && !entry.canCreate && (
              <span className="inline-flex min-h-11 items-center gap-1.5 text-sm text-live md:min-h-10">
                <Check aria-hidden className="size-4" />
                Joined
              </span>
            )}
            {entry.kind === "signed-out" && entry.canJoin && (
              <Link
                href={`/sign-in?callbackUrl=${encodeURIComponent(base)}`}
                className={cn(buttonVariants(), ACTION)}
              >
                Sign in to join
              </Link>
            )}
          </div>
        </div>

        {(phase !== "DRAFT" || jam.startDate) && (
          <div className="mb-6">
            <JamTimeline jam={jam} phase={phase} now={new Date()} />
          </div>
        )}

        <LinkTabs label="Jam sections" tabs={tabs} />
      </div>
    </header>
  );
}
