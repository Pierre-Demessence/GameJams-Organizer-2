"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createCriterionAction, deleteCriterionAction, updateCriterionAction } from "./criterion-actions";

export interface Criterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  isPrimary: boolean;
}

const CELL = "h-11 bg-background px-2.5 md:h-8.5";

function criterionData(c: { name: string; description: string; weight: string; isPrimary: boolean }): FormData {
  const fd = new FormData();
  fd.set("name", c.name);
  fd.set("description", c.description);
  fd.set("weight", c.weight);
  if (c.isPrimary) fd.set("isPrimary", "on");
  return fd;
}

// Rendered inside the jam form, so it uses no <form> of its own and no `name` attributes:
// each row saves itself through the criterion actions when a field loses focus.
export function CriteriaManager({
  jamId,
  criteria,
  locked,
}: {
  jamId: string;
  criteria: Criterion[];
  locked: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function commitDraft() {
    const name = draft?.trim();
    setDraft(null);
    if (!name) return;
    run(() =>
      createCriterionAction(jamId, criterionData({ name, description: "", weight: "1", isPrimary: false }))
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">Criteria</span>
      <div className="overflow-hidden rounded-[10px] border">
        <div className="hidden grid-cols-12 gap-3 border-b bg-card px-3.5 py-2 text-xs text-subtle-foreground md:grid">
          <span className="col-span-7">Name</span>
          <span className="col-span-2">Weight</span>
          <span className="col-span-2">Primary</span>
        </div>
        {criteria.map((c) => (
          <CriterionRow
            key={c.id}
            criterion={c}
            locked={locked}
            pending={isPending}
            onSave={(next) => run(() => updateCriterionAction(c.id, criterionData(next)))}
            onDelete={() => run(() => deleteCriterionAction(c.id))}
          />
        ))}
        {criteria.length === 0 && draft === null && (
          <p className="border-b px-3.5 py-3 text-sm text-muted-foreground">No criteria yet.</p>
        )}
        {draft !== null && (
          <div className="border-b px-3.5 py-2">
            <Input
              autoFocus
              aria-label="New criterion name"
              placeholder="Criterion name, e.g. Gameplay"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitDraft();
                }
                if (e.key === "Escape") setDraft(null);
              }}
              className={CELL}
            />
          </div>
        )}
        {!locked && (
          <button
            type="button"
            onClick={() => setDraft("")}
            disabled={isPending}
            className="flex h-11 w-full items-center px-3.5 text-left text-sm text-brand hover:bg-muted md:h-10"
          >
            + Add criterion
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-subtle-foreground">
        {locked
          ? "Criteria are locked once rating starts."
          : "No primary: overall = weighted average. Weight 0 collects scores without counting toward overall."}
      </p>
    </div>
  );
}

function CriterionRow({
  criterion,
  locked,
  pending,
  onSave,
  onDelete,
}: {
  criterion: Criterion;
  locked: boolean;
  pending: boolean;
  onSave: (next: { name: string; description: string; weight: string; isPrimary: boolean }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(criterion.name);
  const [description, setDescription] = useState(criterion.description ?? "");
  const [weight, setWeight] = useState(String(criterion.weight));
  const changed =
    name !== criterion.name || description !== (criterion.description ?? "") || Number(weight) !== criterion.weight;

  function save(isPrimary = criterion.isPrimary) {
    if (name.trim() === "") {
      setName(criterion.name);
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), weight, isPrimary });
  }

  const blurSave = () => {
    if (changed) save();
  };
  // Enter would otherwise submit the surrounding jam form.
  const enterSaves = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="grid grid-cols-12 items-center gap-x-3 gap-y-2 border-b px-3.5 py-2.5 md:py-2">
      <Input
        aria-label="Criterion name"
        value={name}
        disabled={locked}
        onChange={(e) => setName(e.target.value)}
        onBlur={blurSave}
        onKeyDown={enterSaves}
        maxLength={50}
        className={cn(CELL, "col-span-12 md:col-span-7")}
      />
      <Input
        aria-label={`${criterion.name} weight`}
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={weight}
        disabled={locked}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={blurSave}
        onKeyDown={enterSaves}
        className={cn(CELL, "col-span-4 font-mono text-[13px] md:col-span-2")}
      />
      <div className="col-span-6 md:col-span-2">
        <button
          type="button"
          aria-pressed={criterion.isPrimary}
          disabled={locked || pending}
          onClick={() => save(!criterion.isPrimary)}
          className={cn(
            "inline-flex h-11 items-center rounded-md border px-2.5 text-xs md:h-7",
            criterion.isPrimary ? "border-brand text-brand" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Primary
        </button>
      </div>
      {!locked && (
        <button
          type="button"
          aria-label={`Remove ${criterion.name}`}
          disabled={pending}
          onClick={onDelete}
          className="col-span-2 flex h-11 items-center justify-end text-subtle-foreground hover:text-destructive md:col-span-1 md:h-8"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
      <Input
        aria-label={`${criterion.name} description`}
        placeholder="Description shown to raters (optional)"
        value={description}
        disabled={locked}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={blurSave}
        onKeyDown={enterSaves}
        maxLength={200}
        className={cn(CELL, "col-span-12 text-[13px] md:col-span-11")}
      />
    </div>
  );
}
