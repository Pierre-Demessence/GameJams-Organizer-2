import Link from "next/link";
import { CoverImage } from "@/components/cover-image";
import { JamProgress } from "@/components/jam/jam-progress";
import { JamStatusBadge } from "@/components/jam/jam-status-badge";
import { phaseProgress } from "@/lib/jam-status-display";
import type { JamSummary } from "@/lib/jam-list-queries";

const DAY = new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", timeZone: "UTC" });

function dateRange(start: Date | null, end: Date | null): string {
  if (!start || !end) return "";
  return `${DAY.format(start)} → ${DAY.format(end)}`;
}

export function JamCard({ jam, now }: { jam: JamSummary; now: Date }) {
  return (
    <article className="relative flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative">
        <CoverImage src={jam.coverUrl} alt="" name={jam.name} className="h-30 w-full border-b" />
        <JamStatusBadge phase={jam.phase} className="absolute bottom-3.5 left-3.5 bg-background" />
      </div>
      <div className="flex grow flex-col gap-2.5 p-4">
        {/* Stretched link: the whole card is the target and holds no other interactive element. */}
        <Link href={`/jams/${jam.slug}`} className="font-semibold after:absolute after:inset-0">
          {jam.name}
        </Link>
        <p className="line-clamp-2 text-sm text-muted-foreground">{jam.shortDesc}</p>
        <div className="mt-auto flex flex-col gap-2.5 pt-2">
          <JamProgress phase={jam.phase} value={phaseProgress(jam, jam.phase, now)} />
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs">{dateRange(jam.startDate, jam.endDate)} UTC</span>
            <span className="text-xs text-subtle-foreground">
              {jam.ranked ? "Ranked" : "Showcase"} · {jam.joined} joined
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
