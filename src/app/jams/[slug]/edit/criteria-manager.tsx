"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createCriterionAction,
  updateCriterionAction,
  deleteCriterionAction,
} from "./criterion-actions";

interface Criterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
}

interface CriteriaManagerProps {
  jamId: string;
  criteria: Criterion[];
  locked: boolean;
}

export function CriteriaManager({ jamId, criteria: initialCriteria, locked }: CriteriaManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await createCriterionAction(jamId, formData);
      if (result.error) setError(result.error);
    });
  }

  function handleUpdate(criterionId: string, formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await updateCriterionAction(criterionId, formData);
      if (result.error) setError(result.error);
      else setEditingId(null);
    });
  }

  function handleDelete(criterionId: string) {
    setError("");
    startTransition(async () => {
      const result = await deleteCriterionAction(criterionId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Criteria</CardTitle>
        <CardDescription>
          Define criteria for rating submissions. Weight 0 = feedback only, not scored.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {initialCriteria.map((c) =>
          editingId === c.id ? (
            <form
              key={c.id}
              action={(fd) => handleUpdate(c.id, fd)}
              className="space-y-2 rounded-md border p-3"
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <Label htmlFor={`name-${c.id}`}>Name</Label>
                  <Input
                    id={`name-${c.id}`}
                    name="name"
                    required
                    defaultValue={c.name}
                  />
                </div>
                <div>
                  <Label htmlFor={`desc-${c.id}`}>Description</Label>
                  <Input
                    id={`desc-${c.id}`}
                    name="description"
                    defaultValue={c.description ?? ""}
                  />
                </div>
                <div>
                  <Label htmlFor={`weight-${c.id}`}>Weight</Label>
                  <Input
                    id={`weight-${c.id}`}
                    name="weight"
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    defaultValue={c.weight}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <span className="font-medium">{c.name}</span>
                {c.description && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    — {c.description}
                  </span>
                )}
                <span className="ml-2 text-xs text-muted-foreground">
                  (weight: {c.weight})
                </span>
              </div>
              {!locked && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(c.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDelete(c.id)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )
        )}

        {!locked && (
          <form action={handleCreate} className="space-y-2 rounded-md border border-dashed p-3">
            <p className="text-sm font-medium">Add Criterion</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <Label htmlFor="new-name">Name</Label>
                <Input id="new-name" name="name" required placeholder="Fun" />
              </div>
              <div>
                <Label htmlFor="new-desc">Description</Label>
                <Input
                  id="new-desc"
                  name="description"
                  placeholder="How fun is it?"
                />
              </div>
              <div>
                <Label htmlFor="new-weight">Weight</Label>
                <Input
                  id="new-weight"
                  name="weight"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  defaultValue={1}
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
