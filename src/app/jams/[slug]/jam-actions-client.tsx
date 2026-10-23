"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { joinJamAction, leaveJamAction, publishJamAction } from "@/app/jams/actions";
import { acceptInviteAction, declineInviteAction } from "@/app/submissions/actions";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function JoinJamButton({ jamId, className }: { jamId: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleJoin() {
    setLoading(true);
    setError("");
    const result = await joinJamAction(jamId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      <Button
        onClick={handleJoin}
        disabled={loading}
        className={cn("h-10 min-h-11 px-4 md:min-h-10", className)}
      >
        {loading ? "Joining…" : "Join jam"}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function LeaveJamButton({ jamId, className }: { jamId: string; className?: string }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleLeave() {
    if (!window.confirm("Leave this jam? Your pending team invites are removed. You can join again until submissions close.")) {
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await leaveJamAction(jamId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <Button
        variant="outline"
        onClick={handleLeave}
        disabled={isPending}
        className={cn("h-10 min-h-11 px-4 text-destructive md:min-h-10", className)}
      >
        {isPending ? "Leaving…" : "Leave jam"}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function InviteResponseButtons({ inviteId, label }: { inviteId: string; label: string }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function respond(action: (id: string) => Promise<{ error?: string }>) {
    setError("");
    startTransition(async () => {
      const result = await action(inviteId);
      if (result.error) setError(result.error);
      // A refused accept (team full, window closed) leaves the invite in place, so the refresh keeps it.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Button
          disabled={isPending}
          aria-label={`Accept invite to ${label}`}
          onClick={() => respond(acceptInviteAction)}
          className="h-10 min-h-11 flex-1 md:min-h-9"
        >
          Accept
        </Button>
        <Button
          variant="outline"
          disabled={isPending}
          aria-label={`Decline invite to ${label}`}
          onClick={() => respond(declineInviteAction)}
          className="h-10 min-h-11 flex-1 md:min-h-9"
        >
          Decline
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function PublishJamButton({ jamId, className }: { jamId: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handlePublish() {
    setLoading(true);
    setError("");
    const result = await publishJamAction(jamId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      <Button
        onClick={handlePublish}
        disabled={loading}
        variant="default"
        className={cn("h-10 min-h-11 px-4 md:min-h-10", className)}
      >
        {loading ? "Publishing…" : "Publish jam"}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
