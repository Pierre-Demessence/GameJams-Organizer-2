"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { grantSiteAdminAction, revokeSiteAdminAction } from "./actions";

interface StaffEntry {
  userId: string;
  username: string;
  displayName: string | null;
}

export function StaffManager({
  staff,
  currentUserId,
}: {
  staff: StaffEntry[];
  currentUserId: string;
}) {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleGrant() {
    setError("");
    setLoading(true);
    const result = await grantSiteAdminAction(identifier);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setIdentifier("");
    router.refresh();
  }

  async function handleRevoke(userId: string) {
    setError("");
    setLoading(true);
    const result = await revokeSiteAdminAction(userId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Username or email"
        />
        <Button onClick={handleGrant} disabled={loading || !identifier.trim()}>
          Grant Site Admin
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="divide-y rounded-md border">
        {staff.map((s) => (
          <li key={s.userId} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm">
              {s.displayName ?? s.username}{" "}
              <span className="text-muted-foreground">@{s.username}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || s.userId === currentUserId}
              onClick={() => handleRevoke(s.userId)}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
