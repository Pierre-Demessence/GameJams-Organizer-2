"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import {
  addContributorAction,
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

interface TeamManagerProps {
  submissionId: string;
  currentUserId: string;
  canAdd: boolean;
  canRemove: boolean;
  canTransfer: boolean;
  members: Member[];
  maxTeamSize: number | null;
}

const ROW_ACTION = "h-11 px-2.5 text-xs md:h-7.5";

export function TeamManager({
  submissionId,
  currentUserId,
  canAdd,
  canRemove,
  canTransfer,
  members,
  maxTeamSize,
}: TeamManagerProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>, onDone?: () => void) {
    setError("");
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
    if (name) run(() => addContributorAction(submissionId, name), () => setUsername(""));
  };
  const atCapacity = maxTeamSize ? members.length >= maxTeamSize : false;

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
      </ul>

      {canAdd && !atCapacity && (
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
      {canAdd && atCapacity && (
        <p className="text-xs text-subtle-foreground">The team is full ({maxTeamSize} members).</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
