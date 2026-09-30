import { Suspense } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { JamProgress } from "@/components/jam/jam-progress";
import { Countdown } from "@/components/jam/countdown";
import {
  TONE_TEXT,
  formatDuration,
  formatTimeLeftShort,
  jamStatus,
  nextDeadline,
  phaseProgress,
} from "@/lib/jam-status-display";
import { loadHomeData, type FinishedJam, type HomeJam } from "@/lib/home-queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", timeZone: "UTC" });

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 md:px-12">
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
      <RunningAJam />
    </div>
  );
}

async function HomeContent() {
  const now = new Date();
  const { live, upcoming, finished } = await loadHomeData(now);
  return (
    <>
      <section className="grid gap-10 py-12 md:grid-cols-12 md:gap-8 md:py-24">
        <div className="flex flex-col gap-6 md:col-span-6 md:pt-6">
          <a
            href="https://github.com/Pierre-Demessence/GameJams-Organizer-2"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 self-start md:min-h-8 rounded-full border px-3 text-xs text-muted-foreground"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
            Free and open source
          </a>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.02]">
            Game jams,<br className="hidden md:block" /> run properly.
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
            Create, join and rate game jams. Your games stay on itch.io — we handle the schedule,
            the teams and fair rankings.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link href="/jams" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
              Browse jams
            </Link>
            <Link
              href="/jams/new"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
            >
              Host a jam
            </Link>
          </div>
        </div>
        <LivePanel jams={live} now={now} className="md:col-span-5 md:col-start-8" />
      </section>
      {upcoming.length > 0 && <UpcomingSection jams={upcoming} now={now} />}
      {finished.length > 0 && <ResultsSection jams={finished} />}
    </>
  );
}

const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const SECTION_LINK = "inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground";

function LivePanel({ jams, now, className }: { jams: HomeJam[]; now: Date; className?: string }) {
  return (
    <div className={cn("self-start rounded-xl border bg-card", className)}>
      <div className="flex h-12 items-center justify-between border-b px-4">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden className="size-2 rounded-full bg-live" />
          Live now
        </h2>
        <Link href="/jams" className={SECTION_LINK}>
          View all
        </Link>
      </div>
      {jams.length === 0 ? (
        <div className="flex flex-col items-start gap-2 p-4">
          <p className="text-sm text-muted-foreground">Nothing is live right now.</p>
          <Link href="/jams" className="inline-flex min-h-11 items-center text-sm text-brand hover:underline">
            See what&apos;s coming up
          </Link>
        </div>
      ) : (
        <ul className="divide-y">
          {jams.map((jam) => {
            const deadline = nextDeadline(jam, jam.phase);
            const tone = jamStatus(jam.phase).tone;
            return (
              <li key={jam.id} className="relative flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium"
                  >
                    {initials(jam.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/jams/${jam.slug}`} className="block truncate text-sm font-medium hover:underline after:absolute after:inset-0 after:content-['']">
                      {jam.name}
                    </Link>
                    <p className="text-xs text-subtle-foreground">
                      {jam.joined} joined · {jam.entries} entries
                    </p>
                  </div>
                  {deadline && (
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <Countdown to={deadline.at.toISOString()} />
                      <span className={cn("text-xs", TONE_TEXT[tone])}>{deadline.label}</span>
                    </div>
                  )}
                </div>
                <JamProgress phase={jam.phase} value={phaseProgress(jam, jam.phase, now)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const format = (jam: HomeJam) => (jam.ranked ? "Ranked" : "Showcase");

function UpcomingSection({ jams, now }: { jams: HomeJam[]; now: Date }) {
  return (
    <section className="pb-20">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Upcoming</h2>
        <Link href="/jams" className={SECTION_LINK}>
          Full schedule →
        </Link>
      </div>
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b text-left text-xs text-subtle-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">Starts (UTC)</th>
            <th scope="col" className="py-2 pr-4 font-medium">Jam</th>
            <th scope="col" className="py-2 pr-4 font-medium">Format</th>
            <th scope="col" className="py-2 pr-4 font-medium">Duration</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Joined</th>
            <th scope="col" className="py-2 text-right font-medium">Starts in</th>
          </tr>
        </thead>
        <tbody>
          {jams.map((jam) => (
            <tr key={jam.id} className="border-b">
              <td className="py-3 pr-4 font-mono text-muted-foreground">
                {jam.startDate ? DAY.format(jam.startDate) : "—"}
              </td>
              <td className="py-3 pr-4">
                <Link href={`/jams/${jam.slug}`} className="font-medium hover:underline">
                  {jam.name}
                </Link>
                <p className="line-clamp-1 text-xs text-subtle-foreground">{jam.shortDesc}</p>
              </td>
              <td className="py-3 pr-4 text-muted-foreground">{format(jam)}</td>
              <td className="py-3 pr-4 text-muted-foreground">
                {jam.startDate && jam.endDate ? formatDuration(jam.startDate, jam.endDate) : "—"}
              </td>
              <td className="py-3 pr-4 text-right font-mono">{jam.joined}</td>
              <td className="py-3 text-right font-mono">
                {jam.startDate ? formatTimeLeftShort(jam.startDate.getTime() - now.getTime()) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y border-y md:hidden">
        {jams.map((jam) => (
          <li key={jam.id} className="relative flex items-start gap-4 py-3">
            <span className="w-24 shrink-0 whitespace-nowrap font-mono text-sm text-muted-foreground">
              {jam.startDate ? `${DAY.format(jam.startDate)} UTC` : "—"}
            </span>
            <div className="min-w-0">
              <Link href={`/jams/${jam.slug}`} className="block truncate text-sm font-medium hover:underline after:absolute after:inset-0 after:content-['']">
                {jam.name}
              </Link>
              <p className="text-xs text-subtle-foreground">
                {format(jam)}
                {jam.startDate && jam.endDate && ` · ${formatDuration(jam.startDate, jam.endDate)}`}
                {` · ${jam.joined} joined`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResultsSection({ jams }: { jams: FinishedJam[] }) {
  return (
    <section className="pb-20">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Recent results</h2>
        <Link href="/jams" className={SECTION_LINK}>
          Past jams →
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {jams.map((jam) => (
          <article key={jam.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div>
              <div className="flex items-center justify-between gap-2 md:items-baseline">
                <Link
                  href={jam.ranked ? `/jams/${jam.slug}/results` : `/jams/${jam.slug}`}
                  className="flex min-h-11 min-w-0 items-center font-medium hover:underline md:min-h-0"
                >
                  <span className="truncate">{jam.name}</span>
                </Link>
                {jam.endDate && (
                  <span className="shrink-0 font-mono text-xs text-subtle-foreground">
                    {DAY.format(jam.endDate)} UTC
                  </span>
                )}
              </div>
              <p className="text-xs text-subtle-foreground">
                {jam.ranked
                  ? `${jam.entries} entries${jam.podium !== null ? ` · ${jam.ratings} ratings` : ""}`
                  : `Showcase · ${jam.entries} games`}
              </p>
            </div>
            <PodiumBody jam={jam} />
          </article>
        ))}
      </div>
    </section>
  );
}

function PodiumBody({ jam }: { jam: FinishedJam }) {
  if (jam.podium && jam.podium.length > 0) {
    return (
      <ol className="flex flex-col text-sm">
        {jam.podium.map((p) => (
          <li key={p.submissionId}>
            <Link
              href={`/submissions/${p.submissionId}`}
              className="flex min-h-11 items-center gap-3 hover:underline"
            >
              <span className={cn("w-4 font-mono", p.place === 1 ? "text-rating" : "text-muted-foreground")}>
                {p.place}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              <span className="font-mono text-muted-foreground">{p.score?.toFixed(2)}</span>
            </Link>
          </li>
        ))}
      </ol>
    );
  }
  if (!jam.ranked) {
    return (
      <Link href={`/jams/${jam.slug}`} className="inline-flex min-h-11 items-center text-sm text-brand hover:underline">
        Browse the showcase
      </Link>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      {jam.podium === null ? "Results not revealed yet" : "No ratings yet"}
    </p>
  );
}

const STEPS = [
  { name: "Draft", text: "Write the brief, set dates, criteria and questions. Only organizers can see it.", bar: "bg-input", label: "text-muted-foreground" },
  { name: "Upcoming", text: "Published. People join and find teammates while the theme stays secret.", bar: "bg-brand", label: "text-brand" },
  { name: "Live", text: "The theme drops. Teams build and link their itch.io pages.", bar: "bg-live", label: "text-live" },
  { name: "Rating", text: "Participants play and score entries 1–5 on your criteria.", bar: "bg-rating", label: "text-rating" },
  { name: "Results", text: "Rankings are computed. Reveal them straight away, or when you choose.", bar: "bg-finished", label: "text-finished" },
];

function RunningAJam() {
  return (
    <section className="mb-20 rounded-xl border p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Running a jam?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set it up in private, publish when it&apos;s ready — the dates take it from there.
          </p>
        </div>
        <Link
          href="/jams/new"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 self-start px-5")}
        >
          Host a jam →
        </Link>
      </div>
      <ol className="grid gap-4 md:grid-cols-5">
        {STEPS.map((step) => (
          <li key={step.name} className="flex gap-3 md:flex-col md:gap-3">
            <span aria-hidden className={cn("w-[3px] shrink-0 rounded-full md:h-[3px] md:w-full", step.bar)} />
            <div>
              <p className={cn("text-sm font-medium", step.label)}>{step.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs text-subtle-foreground">
        Showcase jams skip rating — the games are the result.
      </p>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <>
      <div className="h-96 md:h-[28rem]" />
      <div className="grid gap-4 pb-20 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </>
  );
}
