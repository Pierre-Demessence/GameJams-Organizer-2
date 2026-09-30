import type { JamPhase } from "@/domain/jam-phase";
import { TONE_PILL, TONE_TEXT, jamStatus } from "@/lib/jam-status-display";
import { cn } from "@/lib/utils";

export function JamStatusBadge({ phase, className }: { phase: JamPhase; className?: string }) {
  const { label, tone } = jamStatus(phase);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        TONE_PILL[tone],
        TONE_TEXT[tone],
        className
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
