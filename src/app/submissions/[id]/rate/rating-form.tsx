"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitRatingAction } from "./actions";

interface Criterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
}

interface RatingFormProps {
  submissionId: string;
  criteria: Criterion[];
  existingRatings: { criterionId: string; score: number }[];
  nextHref: string | null;
}

const SCALE = [1, 2, 3, 4, 5];

export function RatingForm({ submissionId, criteria, existingRatings, nextHref }: RatingFormProps) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(existingRatings.map((r) => [r.criterionId, r.score]))
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function save(goNext: boolean) {
    setError("");
    if (criteria.some((c) => !scores[c.id])) {
      setError("Score every criterion before saving.");
      return;
    }
    startTransition(async () => {
      const result = await submitRatingAction({
        submissionId,
        ratings: criteria.map((c) => ({ criterionId: c.id, score: scores[c.id] })),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Rating saved");
      if (goNext && nextHref) router.push(nextHref);
      else router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-2.5 md:gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save(Boolean(nextHref));
      }}
    >
      {criteria.map((c) => {
        const value = scores[c.id];
        return (
          <fieldset
            key={c.id}
            className="flex min-w-0 flex-col gap-2.5 rounded-xl border p-3.5 md:gap-3.5 md:p-5"
          >
            <legend className="sr-only">{c.name}</legend>
            <div className="flex items-baseline justify-between gap-3 md:gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-[15px] font-semibold md:text-base">
                  {c.name}
                  {c.weight === 0 && (
                    <span className="text-xs font-normal text-subtle-foreground">Feedback only</span>
                  )}
                </span>
                {c.description && (
                  <span className="text-[13px] text-subtle-foreground">{c.description}</span>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 font-mono text-xs md:text-[13px]",
                  value ? "text-foreground" : "text-subtle-foreground"
                )}
              >
                {value ? `${value} / 5` : "Not scored"}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {SCALE.map((n) => {
                const selected = value === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${c.name}: ${n} out of 5`}
                    onClick={() => setScores((prev) => ({ ...prev, [c.id]: n }))}
                    className={cn(
                      "h-12 rounded-lg border font-mono text-base font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-11 md:text-[15px]",
                      selected
                        ? "border-brand bg-brand text-primary-foreground"
                        : "border-input bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div aria-hidden className="hidden justify-between text-xs text-subtle-foreground md:flex">
              <span>Poor</span>
              <span>Excellent</span>
            </div>
          </fieldset>
        );
      })}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 flex items-center gap-2 border-t bg-background pt-3 pb-3 md:static md:gap-2.5 md:border-0 md:pb-0">
        <p className="hidden flex-1 text-[13px] text-subtle-foreground md:block">
          Anonymous. You can change your scores until rating closes.
        </p>
        {nextHref ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => save(false)}
              className="h-11.5 px-4 text-[15px] md:h-10 md:text-sm"
            >
              Save
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-11.5 flex-1 px-4 text-[15px] font-semibold md:h-10 md:flex-none md:text-sm"
            >
              {isPending ? "Saving…" : "Save & rate next →"}
            </Button>
          </>
        ) : (
          <Button
            type="submit"
            disabled={isPending}
            className="h-11.5 flex-1 px-4 text-[15px] font-semibold md:h-10 md:flex-none md:text-sm"
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    </form>
  );
}
