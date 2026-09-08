"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  disqualifySubmissionAction,
  excludeFromRankingAction,
  reinstateSubmissionAction,
  hideSubmissionAction,
  deleteSubmissionAction,
  manualVerifySubmissionAction,
} from "@/app/submissions/actions";

interface ModerationActionsProps {
  submissionId: string;
  visible: boolean;
  rateable: boolean;
  competing: boolean;
  verified: boolean;
}

export function ModerationActions({
  submissionId,
  visible,
  rateable,
  competing,
  verified,
}: ModerationActionsProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string; success?: boolean }>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  const isModerated = !competing || !rateable;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Moderation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!verified && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isPending}
            onClick={() =>
              run(() => manualVerifySubmissionAction(submissionId))
            }
          >
            Mark verified
          </Button>
        )}

        {competing && rateable && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isPending}
            onClick={() => run(() => disqualifySubmissionAction(submissionId))}
          >
            Disqualify
          </Button>
        )}

        {competing && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isPending}
            onClick={() => run(() => excludeFromRankingAction(submissionId))}
          >
            Exclude from ranking
          </Button>
        )}

        {isModerated && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isPending}
            onClick={() => run(() => reinstateSubmissionAction(submissionId))}
          >
            Reinstate
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isPending}
          onClick={() => run(() => hideSubmissionAction(submissionId))}
        >
          {visible ? "Hide" : "Unhide"}
        </Button>

        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          disabled={isPending}
          onClick={() => {
            if (
              !confirm(
                "Permanently delete this submission? This cannot be undone."
              )
            )
              return;
            run(() => deleteSubmissionAction(submissionId));
          }}
        >
          Delete
        </Button>
      </CardContent>
    </Card>
  );
}
