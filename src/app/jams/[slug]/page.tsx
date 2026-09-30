import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Markdown } from "@/components/markdown";
import { buttonVariants } from "@/components/ui/button-variants";
import { initials } from "@/lib/initials";
import { jamRoleLabel, ratingEligibilityLabel } from "@/lib/jam-labels";
import { entryPanelState } from "@/lib/jam-page";
import { loadJamPage, type JamPageData } from "@/lib/jam-page-queries";
import { cn } from "@/lib/utils";
import { JamHeader } from "./jam-header";
import { JoinJamButton } from "./jam-actions-client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Drafts load as null for anonymous viewers, so their name never leaks into the title.
  const data = await loadJamPage(slug, null);
  if (!data) return { title: "Jam Not Found" };
  return { title: data.jam.name, description: data.jam.shortDesc };
}

const STAMP = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const H2 = "text-lg font-semibold tracking-tight";

export default async function JamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const data = await loadJamPage(slug, session?.user?.id ?? null);
  if (!data) notFound();
  const { jam, phase } = data;

  const hideTheme = jam.revealThemeOnStart && phase === "UPCOMING";

  return (
    <>
      <JamHeader data={data} active="overview" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-8 pb-16 md:grid-cols-12 md:px-12">
        <div className="flex flex-col gap-8 md:col-span-8">
          {jam.theme && (
            <section className="rounded-xl border p-6">
              <h2 className="text-sm text-subtle-foreground">Theme</h2>
              {hideTheme ? (
                <p className="mt-1 text-muted-foreground">Revealed when the jam starts.</p>
              ) : (
                <p className="mt-1 text-3xl font-semibold tracking-tight">{jam.theme}</p>
              )}
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className={H2}>About this jam</h2>
            <Markdown>{jam.fullDesc}</Markdown>
          </section>

          {jam.submissionDetails && (
            <section className="flex flex-col gap-3">
              <h2 className={H2}>Submitting</h2>
              <Markdown>{jam.submissionDetails}</Markdown>
            </section>
          )}

          {jam.ranked && jam.criteria.length > 0 && <Criteria criteria={jam.criteria} />}
        </div>

        <aside className="flex flex-col gap-6 md:col-span-4">
          <EntryCard data={data} />
          <Details data={data} />
          <Organizers roles={jam.roles} />
          {jam.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {jam.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/jams?tag=${encodeURIComponent(tag)}`}
                  className="inline-flex min-h-11 items-center rounded-full border px-3 text-xs text-muted-foreground hover:text-foreground md:min-h-7"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Criteria({ criteria }: { criteria: JamPageData["jam"]["criteria"] }) {
  const primary = criteria.find((c) => c.isPrimary);
  return (
    <section className="flex flex-col gap-3">
      <h2 className={H2}>Rating criteria</h2>
      <ul className="overflow-hidden rounded-xl border">
        {criteria.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-4 border-b p-4">
            <div>
              <p className="font-medium">
                {c.name}
                {c.isPrimary && (
                  <span className="ml-2 rounded border px-1.5 text-[11px] font-normal text-muted-foreground">
                    Primary
                  </span>
                )}
              </p>
              {c.description && <p className="text-sm text-subtle-foreground">{c.description}</p>}
            </div>
            <span className="shrink-0 font-mono text-xs text-subtle-foreground">weight {c.weight}</span>
          </li>
        ))}
        <li className="bg-card p-4 text-sm text-subtle-foreground">
          {primary
            ? `Overall = ${primary.name}.`
            : "Overall = weighted average of criteria. Rated 1–5, Bayesian-adjusted."}
        </li>
      </ul>
    </section>
  );
}

function EntryCard({ data }: { data: JamPageData }) {
  const { jam, phase, viewer } = data;
  const entry = entryPanelState({
    signedIn: Boolean(viewer.userId),
    phase,
    hasJoined: viewer.hasJoined,
    submission: viewer.submission,
  });
  const fullWidth = cn(buttonVariants(), "h-10 min-h-11 w-full md:min-h-10");

  let body: React.ReactNode;
  switch (entry.kind) {
    case "signed-out":
      body = entry.canJoin ? (
        <>
          <p className="text-sm text-muted-foreground">Sign in to join this jam and submit a game.</p>
          <Link href={`/sign-in?callbackUrl=${encodeURIComponent(`/jams/${jam.slug}`)}`} className={fullWidth}>
            Sign in
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Submissions are closed.</p>
      );
      break;
    case "can-join":
      body = (
        <>
          <p className="text-sm text-muted-foreground">Join to submit a game or team up.</p>
          <JoinJamButton jamId={jam.id} className="w-full" />
        </>
      );
      break;
    case "joined":
      body = entry.canCreate ? (
        <>
          <p className="text-sm text-muted-foreground">
            You&apos;ve joined but haven&apos;t submitted yet. Start a draft now — teammates can be added until{" "}
            <span className="font-mono">{jam.endDate ? `${STAMP.format(jam.endDate)} UTC` : "the jam ends"}</span>.
          </p>
          <Link href={`/jams/${jam.slug}/submissions/new`} className={fullWidth}>
            Create submission
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">You&apos;ve joined. Submissions open when the jam starts.</p>
      );
      break;
    case "has-entry":
      body = (
        <>
          <p className="text-sm text-muted-foreground">
            Your game: {entry.status === "SUBMITTED" ? "Submitted" : "Draft"}
          </p>
          <Link
            href={`/submissions/${entry.submissionId}`}
            className={cn(buttonVariants({ variant: "outline" }), "h-10 min-h-11 w-full md:min-h-10")}
          >
            Open your submission
          </Link>
        </>
      );
      break;
    case "closed":
      body = <p className="text-sm text-muted-foreground">Submissions are closed.</p>;
      break;
  }

  return (
    <section aria-label="Your entry" className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <h2 className="text-sm text-subtle-foreground">Your entry</h2>
      {body}
    </section>
  );
}

function Details({ data }: { data: JamPageData }) {
  const { jam } = data;
  const rows: [string, React.ReactNode][] = [
    ["Format", jam.ranked ? "Ranked" : "Showcase"],
    ["Team size", jam.maxTeamSize ? `Up to ${jam.maxTeamSize}` : "Any size"],
  ];
  if (jam.ranked) rows.push(["Who can rate", ratingEligibilityLabel(jam.ratingEligibility)]);
  rows.push(
    ["Joined", <span key="j" className="font-mono">{jam._count.participants}</span>],
    ["Submissions", <span key="s" className="font-mono">{jam._count.submissions}</span>]
  );
  if (jam.ranked) rows.push(["Results", jam.hideResults ? "Revealed by organizers" : "Public when rating ends"]);

  return (
    <dl>
      {rows.map(([term, value]) => (
        <div key={term} className="flex justify-between gap-4 border-b py-2.5 text-sm">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Organizers({ roles }: { roles: JamPageData["jam"]["roles"] }) {
  const byUser = new Map<string, { user: (typeof roles)[number]["user"]; labels: string[] }>();
  for (const r of roles) {
    const entry = byUser.get(r.userId) ?? { user: r.user, labels: [] };
    entry.labels.push(jamRoleLabel(r.role));
    byUser.set(r.userId, entry);
  }
  if (byUser.size === 0) return null;

  return (
    <section aria-label="Organizers" className="flex flex-col gap-1">
      <h2 className="text-sm text-subtle-foreground">Organizers</h2>
      <ul>
        {[...byUser.values()].map(({ user, labels }) => {
          const name = user.displayName ?? user.username;
          return (
            <li key={user.username} className="flex items-center gap-3 py-1">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="size-7 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-subtle-foreground"
                >
                  {initials(name)}
                </span>
              )}
              <Link href={`/users/${user.username}`} className="flex min-h-11 items-center text-sm hover:underline md:min-h-0">
                {name}
              </Link>
              <span className="ml-auto text-xs text-subtle-foreground">{labels.join(" · ")}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
