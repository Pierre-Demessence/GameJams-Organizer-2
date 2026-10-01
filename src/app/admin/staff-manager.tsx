"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { grantSiteAdminAction, revokeSiteAdminAction } from "./actions";

interface StaffEntry {
  userId: string;
  username: string;
  displayName: string | null;
}

export function StaffManager({ staff, currentUserId }: { staff: StaffEntry[]; currentUserId: string }) {
  const [identifier, setIdentifier] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<{ error?: string }>, done: string, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="rounded-xl border">
        {staff.map((s, i) => {
          const name = s.displayName ?? s.username;
          const self = s.userId === currentUserId;
          return (
            <li key={s.userId} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", i < staff.length - 1 && "border-b")}>
              <span
                aria-hidden
                className={cn(
                  "flex size-7.5 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold",
                  self ? "text-brand" : "text-muted-foreground"
                )}
              >
                {initials(name)}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                {name} <span className="text-subtle-foreground">@{s.username}</span>
                {self && <span className="text-subtle-foreground"> (you)</span>}
              </span>
              <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs font-medium">Site Admin</span>
              {!self && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(() => revokeSiteAdminAction(s.userId), `Revoked ${s.username}`)}
                  className="h-11 px-2.5 text-xs text-destructive md:h-7.5"
                >
                  Revoke
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (identifier.trim()) run(() => grantSiteAdminAction(identifier), "Site Admin granted", () => setIdentifier(""));
        }}
      >
        <Input
          aria-label="Username or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Username or email"
          className="h-11 flex-1 bg-card px-3 md:h-9"
        />
        <Button type="submit" variant="outline" disabled={isPending || !identifier.trim()} className="h-11 md:h-9">
          Grant Site Admin
        </Button>
      </form>
    </div>
  );
}
