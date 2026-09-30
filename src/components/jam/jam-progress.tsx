import type { JamPhase } from "@/domain/jam-phase";
import { TONE_BG, jamStatus } from "@/lib/jam-status-display";
import { cn } from "@/lib/utils";

export function JamProgress({
  phase,
  value,
  className,
}: {
  phase: JamPhase;
  value: number;
  className?: string;
}) {
  const { label, tone } = jamStatus(phase);
  return (
    <div
      role="progressbar"
      aria-label={`${label} progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn("h-0.75 overflow-hidden rounded-full bg-track", className)}
    >
      <div className={cn("h-full", TONE_BG[tone])} style={{ width: `${value}%` }} />
    </div>
  );
}
