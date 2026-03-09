"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  members: Member[];
  maxTeamSize: number | null;
}

export function TeamManager({
  submissionId,
  members: initialMembers,
  maxTeamSize,
}: TeamManagerProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!username.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await addContributorAction(submissionId, username.trim());
      if (result.error) setError(result.error);
      else setUsername("");
    });
  }

  function handleRemove(contributorUserId: string) {
    setError("");
    startTransition(async () => {
      const result = await removeContributorAction(submissionId, contributorUserId);
      if (result.error) setError(result.error);
    });
  }

  function handleTransfer(newLeaderUserId: string) {
    setError("");
    startTransition(async () => {
      const result = await transferLeaderAction(submissionId, newLeaderUserId);
      if (result.error) setError(result.error);
    });
  }

  const atCapacity = maxTeamSize ? initialMembers.length >= maxTeamSize : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manage Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <ul className="space-y-2">
          {initialMembers.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-sm">
              <span>
                {m.displayName ?? m.username}
                {m.isLeader && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    Leader
                  </Badge>
                )}
              </span>
              {!m.isLeader && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleTransfer(m.userId)}
                  >
                    Promote
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleRemove(m.userId)}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {!atCapacity && (
          <div className="flex gap-2">
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-8 text-sm"
            />
            <Button size="sm" disabled={isPending} onClick={handleAdd}>
              Add
            </Button>
          </div>
        )}
        {atCapacity && (
          <p className="text-xs text-muted-foreground">
            Team is at maximum size ({maxTeamSize}).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
