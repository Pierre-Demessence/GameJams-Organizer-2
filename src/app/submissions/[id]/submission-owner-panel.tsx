"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  verifySubmissionAction,
  submitSubmissionAction,
  unsubmitSubmissionAction,
} from "@/app/submissions/actions";

interface SubmissionOwnerPanelProps {
  submissionId: string;
  status: "DRAFT" | "SUBMITTED";
  itchUrl: string | null;
  verificationCode: string | null;
  verified: boolean;
  canFinalize: boolean;
}

export function SubmissionOwnerPanel({
  submissionId,
  status,
  itchUrl,
  verificationCode,
  verified,
  canFinalize,
}: SubmissionOwnerPanelProps) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string; success?: boolean }>) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Submission status{" "}
          <Badge variant={status === "SUBMITTED" ? "default" : "secondary"}>
            {status === "SUBMITTED" ? "Submitted" : "Draft"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        {!itchUrl ? (
          <p className="text-sm text-muted-foreground">
            Add your itch.io project link to start verification.
          </p>
        ) : verified ? (
          <p className="text-sm text-muted-foreground">
            Ownership verified.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Add this code anywhere on your itch.io project page, then verify:
            </p>
            {verificationCode && (
              <code className="block rounded bg-muted px-2 py-1 text-xs">
                {verificationCode}
              </code>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  const r = await verifySubmissionAction(submissionId);
                  if (r.success) setMessage("Verified!");
                  return r;
                })
              }
            >
              Verify ownership
            </Button>
          </div>
        )}

        {status === "DRAFT" ? (
          <Button
            size="sm"
            className="w-full"
            disabled={isPending || !verified || !canFinalize}
            onClick={() => run(() => submitSubmissionAction(submissionId))}
          >
            Submit to jam
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={isPending || !canFinalize}
            onClick={() => run(() => unsubmitSubmissionAction(submissionId))}
          >
            Withdraw to draft
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
