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
  hideSubmissionAction,
  deleteSubmissionAction,
} from "@/app/submissions/actions";

interface ModerationActionsProps {
  submissionId: string;
  isDisqualified: boolean;
  isHidden: boolean;
}

export function ModerationActions({
  submissionId,
  isDisqualified,
  isHidden,
}: ModerationActionsProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDisqualify() {
    setError("");
    startTransition(async () => {
      const result = await disqualifySubmissionAction(submissionId);
      if (result.error) setError(result.error);
    });
  }

  function handleHide() {
    setError("");
    startTransition(async () => {
      const result = await hideSubmissionAction(submissionId);
      if (result.error) setError(result.error);
    });
  }

  function handleDelete() {
    if (!confirm("Permanently delete this submission? This cannot be undone.")) return;
    setError("");
    startTransition(async () => {
      const result = await deleteSubmissionAction(submissionId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Moderation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!isDisqualified && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isPending}
            onClick={handleDisqualify}
          >
            Disqualify
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isPending}
          onClick={handleHide}
        >
          {isHidden ? "Unhide" : "Hide"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          disabled={isPending}
          onClick={handleDelete}
        >
          Delete
        </Button>
      </CardContent>
    </Card>
  );
}
