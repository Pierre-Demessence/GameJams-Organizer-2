"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountBlocker } from "@/domain/account";
import { blockerHref, blockerLinkLabel } from "@/lib/account-deletion";
import { deleteAccountAction } from "./actions";
import { FIELD } from "./profile-form";

interface Props {
  username: string;
  blockers: AccountBlocker[];
  removes: string[];
  keeps: string[];
}

export function DeleteAccount({ username, blockers: initialBlockers, removes, keeps }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState(initialBlockers);
  const [loading, setLoading] = useState(false);
  const blocked = blockers.length > 0;
  const matches = typed.trim().toLowerCase() === username;

  async function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await deleteAccountAction(typed);
    if ("success" in result) {
      await signOut({ callbackUrl: "/" });
      return;
    }
    setLoading(false);
    setError(result.error);
    // Something changed since the page loaded (a new team, a role): show the current blockers.
    if (result.blockers) {
      setBlockers(result.blockers);
      setConfirming(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-destructive/40 p-4.5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <p className="flex flex-1 items-center gap-2 text-sm font-medium">
          <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
          This cannot be undone.
        </p>
        {!confirming && (
          <Button
            variant="destructive"
            className="h-11 md:h-9"
            disabled={blocked}
            onClick={() => setConfirming(true)}
          >
            Delete account…
          </Button>
        )}
      </div>

      {blocked && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5">
          <p className="text-sm font-medium">Resolve {blockers.length === 1 ? "this" : "these"} before you can delete your account:</p>
          <ul className="flex flex-col gap-2">
            {blockers.map((b) => (
              <li key={`${b.kind}-${b.id}`} className="flex flex-col gap-1 text-sm md:flex-row md:items-center md:gap-3">
                <span className="flex-1">{b.reason}</span>
                <Link href={blockerHref(b)} className="font-medium underline underline-offset-2 hover:text-brand">
                  {blockerLinkLabel(b)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 text-sm md:grid-cols-2">
        <SummaryList title="Removed" items={removes} />
        <SummaryList title="Kept" items={keeps} />
      </div>

      {confirming && !blocked && (
        <form onSubmit={handleDelete} className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-username">
              Type <span className="font-mono">{username}</span> to confirm
            </Label>
            <Input
              id="confirm-username"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={`${FIELD} max-w-sm font-mono`}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2 md:flex-row">
            <Button
              type="submit"
              variant="destructive"
              className="h-11 md:h-9"
              disabled={!matches || loading}
            >
              {loading ? "Deleting…" : "Permanently delete my account"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 md:h-9"
              disabled={loading}
              onClick={() => {
                setConfirming(false);
                setTyped("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {!confirming && error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold tracking-wide text-subtle-foreground uppercase">{title}</h4>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
