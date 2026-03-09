"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
}

export function RatingForm({
  submissionId,
  criteria,
  existingRatings,
}: RatingFormProps) {
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const c of criteria) {
      const existing = existingRatings.find((r) => r.criterionId === c.id);
      initial[c.id] = existing?.score ?? 3;
    }
    return initial;
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError("");
    setSuccess(false);
    startTransition(async () => {
      const result = await submitRatingAction({
        submissionId,
        ratings: criteria.map((c) => ({
          criterionId: c.id,
          score: scores[c.id],
        })),
      });
      if (result.error) setError(result.error);
      else setSuccess(true);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate this Submission</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-600">Ratings submitted!</p>
        )}

        {criteria.map((c) => (
          <div key={c.id} className="space-y-1">
            <Label className="flex items-center gap-2">
              {c.name}
              {c.weight === 0 && (
                <span className="text-xs text-muted-foreground">(feedback only)</span>
              )}
            </Label>
            {c.description && (
              <p className="text-xs text-muted-foreground">{c.description}</p>
            )}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setScores((prev) => ({ ...prev, [c.id]: n }))
                  }
                  className={`h-10 w-10 rounded-md border text-sm font-medium transition-colors ${
                    scores[c.id] === n
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}

        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Submitting..." : existingRatings.length > 0 ? "Update Ratings" : "Submit Ratings"}
        </Button>
      </CardContent>
    </Card>
  );
}
