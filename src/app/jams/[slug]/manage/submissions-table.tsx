"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  deleteSubmissionAction,
  disqualifySubmissionAction,
  excludeFromRankingAction,
  hideSubmissionAction,
  manualVerifySubmissionAction,
  reinstateSubmissionAction,
} from "@/app/submissions/actions";
import { filterManageRows, moderationFlag, type ManageStatusFilter } from "@/lib/manage";
import type { ManageSubmission } from "@/lib/manage-queries";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: { value: ManageStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "draft", label: "Draft" },
  { value: "flagged", label: "Flagged" },
];

export function SubmissionsTable({ rows, canDelete }: { rows: ManageSubmission[]; canDelete: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ManageStatusFilter>("all");
  const shown = filterManageRows(rows, query, status);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <h2 id="submissions-title" className="flex-1 text-lg font-semibold">
          Submissions
        </h2>
        <Input
          type="search"
          aria-label="Filter submissions"
          placeholder="Filter by title or member"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 bg-card px-2.5 text-[13px] md:h-8.5 md:w-60 md:text-[13px]"
        />
        <select
          aria-label="Status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value as ManageStatusFilter)}
          className="h-11 rounded-lg border border-input bg-card px-2 text-[13px] md:h-8.5"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border py-10 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? "No submissions yet." : "No submissions match these filters."}
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="hidden md:table-header-group">
            <tr className="text-left text-xs text-subtle-foreground">
              <th scope="col" className="border-b pb-2.5 font-medium">Game</th>
              <th scope="col" className="w-30 border-b pb-2.5 font-medium">Status</th>
              <th scope="col" className="w-22.5 border-b pb-2.5 text-center font-medium">Visible</th>
              <th scope="col" className="w-22.5 border-b pb-2.5 text-center font-medium">Rateable</th>
              <th scope="col" className="w-25 border-b pb-2.5 text-center font-medium">Competing</th>
              <th scope="col" className="w-20 border-b pb-2.5 text-right font-medium">Ratings</th>
              <th scope="col" className="w-12 border-b pb-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <Row key={r.id} row={r} canDelete={canDelete} />
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-subtle-foreground">
        Presets in ⋯: Disqualify (not rateable, not competing), Exclude from ranking (not competing), Hide, Mark
        verified{canDelete ? ", Delete" : ""}.
      </p>
    </div>
  );
}

// Rows stack as cards on phones and become table rows from md up.
const CELL = "md:border-b md:py-3";

const FLAG_STYLE = {
  Disqualified: "border-destructive text-destructive",
  "Not competing": "border-input text-muted-foreground",
  Hidden: "border-input text-muted-foreground",
} as const;

function Row({ row, canDelete }: { row: ManageSubmission; canDelete: boolean }) {
  const flag = moderationFlag(row);
  return (
    <tr role="row" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b py-3 md:table-row md:border-0 md:py-0">
      <td role="cell" className={cn("w-full md:w-auto md:pr-3", CELL)}>
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <Link href={`/submissions/${row.id}`} className="font-medium hover:text-brand">
                {row.title}
              </Link>
              {flag && (
                <span
                  title={row.moderationReason ?? undefined}
                  className={cn("inline-flex h-5 items-center rounded-[5px] border px-1.5 text-[11px] font-medium", FLAG_STYLE[flag])}
                >
                  {flag}
                </span>
              )}
            </span>
            <span className="text-xs text-subtle-foreground">{row.team.join(", ")}</span>
          </div>
          <div className="md:hidden">
            <RowMenu row={row} canDelete={canDelete} />
          </div>
        </div>
      </td>
      <td role="cell" className={cn("text-[13px]", CELL, row.status === "SUBMITTED" ? "text-foreground" : "text-subtle-foreground")}>
        {row.status === "SUBMITTED" ? "Submitted" : "Draft"}
      </td>
      <SwitchCell label="Visible" on={row.visible} />
      <SwitchCell label="Rateable" on={row.rateable} />
      <SwitchCell label="Competing" on={row.competing} />
      <td role="cell" className={cn("font-mono text-[13px] text-muted-foreground md:text-right", CELL)}>
        <span className="md:hidden">Ratings </span>
        {row.raters ?? "—"}
      </td>
      <td role="cell" className={cn("hidden text-right md:table-cell", CELL)}>
        <RowMenu row={row} canDelete={canDelete} />
      </td>
    </tr>
  );
}

// Read-only: the switches change only through the moderation presets (spec §5.4).
function SwitchCell({ label, on }: { label: string; on: boolean }) {
  return (
    <td role="cell" className="text-center md:border-b md:py-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="md:hidden">{label}</span>
        <span
          role="img"
          aria-label={`${label}: ${on ? "yes" : "no"}`}
          className={cn("inline-flex h-4.5 w-7.5 rounded-full p-0.5", on ? "justify-end bg-live" : "justify-start bg-input")}
        >
          <span className="size-3.5 rounded-full bg-foreground" />
        </span>
      </span>
    </td>
  );
}

function RowMenu({ row, canDelete }: { row: ManageSubmission; canDelete: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(label: string, action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else toast.success(label);
      router.refresh();
    });
  }

  const moderated = !row.competing || !row.rateable || !row.visible;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${row.title}`}
        disabled={isPending}
        className="inline-flex size-11 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground md:size-8"
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {row.rateable && (
          <DropdownMenuItem onClick={() => run("Disqualified", () => disqualifySubmissionAction(row.id))}>
            Disqualify
          </DropdownMenuItem>
        )}
        {row.competing && (
          <DropdownMenuItem onClick={() => run("Excluded from ranking", () => excludeFromRankingAction(row.id))}>
            Exclude from ranking
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => run(row.visible ? "Hidden" : "Visible again", () => hideSubmissionAction(row.id))}>
          {row.visible ? "Hide" : "Unhide"}
        </DropdownMenuItem>
        {moderated && (
          <DropdownMenuItem onClick={() => run("Reinstated", () => reinstateSubmissionAction(row.id))}>
            Reinstate
          </DropdownMenuItem>
        )}
        {!row.verified && (
          <DropdownMenuItem onClick={() => run("Marked verified", () => manualVerifySubmissionAction(row.id))}>
            Mark verified
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                if (window.confirm(`Delete "${row.title}"? Staff can restore it later.`)) {
                  run("Deleted", () => deleteSubmissionAction(row.id));
                }
              }}
            >
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
