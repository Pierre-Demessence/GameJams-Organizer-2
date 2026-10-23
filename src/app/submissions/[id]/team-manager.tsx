"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import {
  cancelInviteAction,
  inviteContributorAction,
  leaveSubmissionAction,
  removeContributorAction,
  transferLeaderAction,
} from "@/app/submissions/actions";

interface Member {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  isLeader: boolean;
}

interface PendingInvite {
  id: string;
  username: string;
  displayName: string | null;
}

interface TeamManagerProps {
  submissionId: string;
  jamSlug: string;
  currentUserId: string;
  canInvite: boolean;
  canRemove: boolean;
  canTransfer: boolean;
  canLeave: boolean;
  // Shown instead of the Leave button when the leader has to hand over first.
  leaveHint: string | null;
  members: Member[];
  invites: PendingInvite[];
  maxTeamSize: number | null;
}

const ROW_ACTION = "h-11 px-2.5 text-xs md:h-7.5";

export function TeamManager({
  submissionId,
  jamSlug,
  currentUserId,
  canInvite,
  canRemove,
  canTransfer,
  canLeave,
  leaveHint,
  members,
  invites,
  maxTeamSize,
}: TeamManagerProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>, onDone?: () => void) {
    setError("");
    setNotice("");
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  const invite = () => {
    const name = username.trim().replace(/^@/, "");
    if (!name) return;
    run(
      () => inviteContributorAction(submissionId, name),
      () => {
        setUsername("");
        setNotice("Invite sent. They are not notified yet: share the jam link so they can accept it.");
      }
    );
  };
  const leave = () => {
    if (!window.confirm("Leave this team? You stay joined to the jam and can be invited again.")) return;
    run(
      () => leaveSubmissionAction(submissionId),
      () => router.push(`/jams/${jamSlug}`)
    );
  };
  // Pending invites hold a seat, the same way the invite rule counts them.
  const atCapacity = maxTeamSize ? members.length + invites.length >= maxTeamSize : false;

  return (
    <div className="flex flex-col gap-3">
      <ul className="rounded-xl border">
        {members.map((m, i) => {
          const name = m.displayName ?? m.username;
          return (
            <li
              key={m.id}
              className={cn("flex flex-wrap items-center gap-3 px-4 py-3", i < members.length - 1 && "border-b")}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-7.5 shrink-0 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold",
                  m.userId === currentUserId ? "text-brand" : "text-muted-foreground"
                )}
              >
                {initials(name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {name}
                {m.userId === currentUserId && <span className="text-subtle-foreground"> (you)</span>}
              </span>
              {m.isLeader ? (
                <span className="text-xs text-muted-foreground">Team leader</span>
              ) : (
                <div className="flex gap-1.5">
                  {canTransfer && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => run(() => transferLeaderAction(submissionId, m.userId))}
                      className={ROW_ACTION}
                    >
                      Make leader
                    </Button>
                  )}
                  {canRemove && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      aria-label={`Remove ${name}`}
                      onClick={() => run(() => removeContributorAction(submissionId, m.userId))}
                      className={cn(ROW_ACTION, "text-destructive")}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {invites.map((inv) => {
          const name = inv.displayName ?? inv.username;
          return (
            <li
              key={inv.id}
              className="flex flex-wrap items-center gap-3 border-t px-4 py-3"
            >
              <span
                aria-hidden
                className="flex size-7.5 shrink-0 items-center justify-center rounded-full border border-dashed bg-muted text-[11px] font-semibold text-muted-foreground"
              >
                {initials(name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{name}</span>
                <span className="block text-xs text-muted-foreground">Pending</span>
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                aria-label={`Cancel invite for ${name}`}
                onClick={() => run(() => cancelInviteAction(inv.id))}
                className={ROW_ACTION}
              >
                Cancel
              </Button>
            </li>
          );
        })}
      </ul>

      {canInvite && !atCapacity && (
        <div className="flex gap-2">
          <Input
            aria-label="Invite by username"
            placeholder="Invite by username: they must have joined the jam"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                invite();
              }
            }}
            className="h-11 flex-1 bg-card px-3 md:h-9.5"
          />
          <Button type="button" variant="outline" disabled={isPending || !username.trim()} onClick={invite} className="h-11 px-3.5 md:h-9.5">
            Invite
          </Button>
        </div>
      )}
      {canInvite && atCapacity && (
        <p className="text-xs text-subtle-foreground">
          The team is full ({maxTeamSize} seats, pending invites included).
        </p>
      )}
      {canLeave && (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={leave}
          className="h-11 w-full text-destructive md:h-9.5"
        >
          Leave team
        </Button>
      )}
      {leaveHint && <p className="text-xs text-subtle-foreground">{leaveHint}</p>}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
