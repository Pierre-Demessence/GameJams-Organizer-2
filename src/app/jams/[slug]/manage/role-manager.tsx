"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/initials";
import { jamRoleLabel } from "@/lib/jam-labels";
import { cn } from "@/lib/utils";
import { assignRoleAction, removeRoleAction, searchUsersForRole } from "./actions";

const ROLE_OPTIONS = ["ADMIN", "MODERATOR", "JUDGE", "HOST"] as const;
type Role = (typeof ROLE_OPTIONS)[number];

const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Everything, including roles and deleting the jam",
  MODERATOR: "Moderate, verify and delete submissions",
  JUDGE: "Can always rate, whatever the rating audience",
  HOST: "Shown as a host; no extra powers",
};

interface RoleEntry {
  userId: string;
  role: Role;
  user: { username: string; displayName: string | null };
}

interface Organizer {
  userId: string;
  user: RoleEntry["user"];
  roles: Role[];
}

export function RoleManager({
  jamId,
  creatorId,
  currentUserId,
  roles,
}: {
  jamId: string;
  creatorId: string;
  currentUserId: string;
  roles: RoleEntry[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  const organizers = Object.values(
    roles.reduce<Record<string, Organizer>>((acc, r) => {
      acc[r.userId] ??= { userId: r.userId, user: r.user, roles: [] };
      acc[r.userId].roles.push(r.role);
      return acc;
    }, {})
  ).sort((a, b) => Number(b.userId === creatorId) - Number(a.userId === creatorId));

  function run(action: () => Promise<{ error?: string }>, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <h2 id="organizers-title" className="flex-1 text-lg font-semibold">
          Organizers
        </h2>
        {!adding && (
          <Button type="button" variant="outline" onClick={() => setAdding(true)} className="h-11 px-3 text-[13px] md:h-8.5">
            Add organizer
          </Button>
        )}
      </div>

      {adding && <AddOrganizer jamId={jamId} onClose={() => setAdding(false)} />}

      <ul className="rounded-xl border">
        {organizers.map((o, i) => {
          const name = o.user.displayName ?? o.user.username;
          const isSelf = o.userId === currentUserId;
          const note = [isSelf && "you", o.userId === creatorId && "creator"].filter(Boolean).join(", ");
          return (
            <li key={o.userId} className={cn("flex flex-col gap-3 px-4 py-3", i < organizers.length - 1 && "border-b")}>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-7.5 shrink-0 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold text-muted-foreground"
                >
                  {initials(name)}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  {name} {note && <span className="text-subtle-foreground">({note})</span>}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {o.roles.map((r) => (
                    <span key={r} className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs font-medium">
                      {jamRoleLabel(r)}
                    </span>
                  ))}
                </div>
                {/* Your own roles cannot be changed here, so nobody locks themselves out. */}
                {!isSelf && (
                  <Button
                    type="button"
                    variant="outline"
                    aria-expanded={editing === o.userId}
                    onClick={() => setEditing(editing === o.userId ? null : o.userId)}
                    className="h-11 px-2.5 text-xs md:h-7.5"
                  >
                    {editing === o.userId ? "Done" : "Edit roles"}
                  </Button>
                )}
              </div>
              {editing === o.userId && (
                <fieldset className="flex flex-wrap gap-2 pl-10.5">
                  <legend className="sr-only">Roles for {name}</legend>
                  {ROLE_OPTIONS.map((r) => {
                    const has = o.roles.includes(r);
                    const locked = o.userId === creatorId && r === "ADMIN";
                    return (
                      <label
                        key={r}
                        title={locked ? "The creator always stays an admin" : ROLE_HELP[r]}
                        className={cn(
                          "flex h-11 items-center gap-2 rounded-lg border px-3 text-sm md:h-8.5",
                          has ? "border-input bg-muted" : "",
                          (locked || isPending) && "opacity-60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={has}
                          disabled={locked || isPending}
                          onChange={() =>
                            run(() =>
                              has
                                ? removeRoleAction(jamId, o.userId, r)
                                : assignRoleAction(jamId, o.user.username, r)
                            )
                          }
                          className="size-4 accent-brand"
                        />
                        {jamRoleLabel(r)}
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AddOrganizer({ jamId, onClose }: { jamId: string; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Role>("JUDGE");
  const [results, setResults] = useState<{ id: string; username: string; displayName: string | null }[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const search = () => {
    if (query.trim().length < 2) return;
    startTransition(async () => {
      const result = await searchUsersForRole(query.trim());
      setResults(result.users);
    });
  };

  const assign = (username: string) =>
    startTransition(async () => {
      const result = await assignRoleAction(jamId, username, role);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${username} is now ${jamRoleLabel(role)}`);
      router.refresh();
      onClose();
    });

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <Input
          autoFocus
          aria-label="Search users"
          placeholder="Search by username (2+ letters)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          className="h-11 flex-1 bg-background px-3 md:h-9"
        />
        <select
          aria-label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="h-11 rounded-lg border border-input bg-background px-2 text-sm md:h-9"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {jamRoleLabel(r)}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={search} disabled={isPending} className="h-11 md:h-9">
          Search
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} className="h-11 md:h-9">
          Cancel
        </Button>
      </div>
      <p className="text-xs text-subtle-foreground">{ROLE_HELP[role]}.</p>
      {results &&
        (results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {results.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                <span>
                  {u.displayName ?? u.username} <span className="text-subtle-foreground">@{u.username}</span>
                </span>
                <Button type="button" onClick={() => assign(u.username)} disabled={isPending} className="h-11 px-3 md:h-8">
                  Add as {jamRoleLabel(role)}
                </Button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
