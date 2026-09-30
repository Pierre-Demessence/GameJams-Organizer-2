import type { JamPhase, JamPhaseInput } from "@/domain/jam-phase";
import { Countdown } from "@/components/jam/countdown";
import { jamTimeline } from "@/lib/jam-page";
import { TONE_BG, jamStatus, nextDeadline } from "@/lib/jam-status-display";
import { cn } from "@/lib/utils";

const STAMP = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function JamTimeline({ jam, phase, now }: { jam: JamPhaseInput; phase: JamPhase; now: Date }) {
  const deadline = nextDeadline(jam, phase);
  const segments = jamTimeline(jam, phase, now);
  const tone = jamStatus(phase).tone;

  return (
    <section
      aria-label="Jam timeline"
      className="flex flex-col gap-5 rounded-xl border bg-card p-5 md:flex-row md:items-center md:gap-10 md:px-6"
    >
      <div className="shrink-0 md:w-56">
        {deadline ? (
          <>
            <p className="text-sm text-muted-foreground">{deadline.label} in</p>
            <Countdown
              to={deadline.at.toISOString()}
              className="text-2xl font-medium tracking-tight md:text-[1.75rem]"
            />
            <p className="font-mono text-xs text-subtle-foreground">{STAMP.format(deadline.at)} UTC</p>
          </>
        ) : (
          <p className="text-lg font-medium">{phase === "DRAFT" ? "Not published yet" : "Finished"}</p>
        )}
      </div>
      <div className="flex-1">
        <div className="flex h-1.5 gap-0.75">
          {segments.map((s) => (
            <div
              key={s.key}
              className={cn("overflow-hidden rounded-full", s.state === "past" ? "bg-input" : "bg-track")}
              style={{ width: `${s.widthPct}%` }}
            >
              {s.state === "current" && (
                <div className={cn("h-full", TONE_BG[tone])} style={{ width: `${s.progress}%` }} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-0.75">
          {segments.map((s) => (
            <div key={s.key} style={{ width: `${s.widthPct}%` }} className="min-w-0 text-xs">
              <p className={s.state === "current" ? "font-medium text-foreground" : "text-subtle-foreground"}>
                {s.label}
                {s.state === "current" && " — now"}
              </p>
              <p className={cn("font-mono", s.state !== "current" && "hidden sm:block", "text-subtle-foreground")}>
                {s.dates}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
