"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCustomFieldAction,
  deleteCustomFieldAction,
  updateCustomFieldAction,
} from "./custom-field-actions";

export interface CustomField {
  id: string;
  name: string;
  description: string | null;
  type: string;
  required: boolean;
  isPrivate: boolean;
}

type FieldType = "SINGLE_LINE" | "MULTI_LINE" | "URL";
const TYPE_LABEL: Record<FieldType, string> = { SINGLE_LINE: "Single line", MULTI_LINE: "Multi-line", URL: "Link" };

interface Draft {
  name: string;
  description: string;
  type: FieldType;
  required: boolean;
  isPrivate: boolean;
}

function fieldData(d: Draft): FormData {
  const fd = new FormData();
  fd.set("name", d.name.trim());
  fd.set("description", d.description.trim());
  fd.set("type", d.type);
  fd.set("required", String(d.required));
  fd.set("isPrivate", String(d.isPrivate));
  return fd;
}

export function describeField(f: { type: string; required: boolean; isPrivate: boolean }): string {
  return [
    TYPE_LABEL[f.type as FieldType] ?? f.type,
    f.required ? "Required" : "Optional",
    f.isPrivate ? "Private" : "Public",
  ].join(" · ");
}

// Rendered inside the jam form, so it uses no <form> of its own and no `name` attributes.
export function CustomFieldsManager({
  jamId,
  fields,
  locked,
}: {
  jamId: string;
  fields: CustomField[];
  locked: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">Custom questions</span>
      <ul className="rounded-[10px] border">
        {fields.map((f) =>
          editing === f.id ? (
            <li key={f.id} className="border-b">
              <FieldEditor
                initial={{
                  name: f.name,
                  description: f.description ?? "",
                  type: f.type as FieldType,
                  required: f.required,
                  isPrivate: f.isPrivate,
                }}
                pending={isPending}
                onSave={(d) => run(() => updateCustomFieldAction(f.id, jamId, fieldData(d)))}
                onDelete={() => run(() => deleteCustomFieldAction(f.id, jamId))}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3.5 py-3 text-sm">
              <span className="flex-1">{f.name}</span>
              <span className="text-xs text-subtle-foreground">{describeField(f)}</span>
              {!locked && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(f.id)}
                  className="h-11 px-2.5 text-xs md:h-7"
                >
                  Edit
                </Button>
              )}
            </li>
          )
        )}
        {editing === "new" ? (
          <li>
            <FieldEditor
              initial={{ name: "", description: "", type: "SINGLE_LINE", required: false, isPrivate: false }}
              pending={isPending}
              onSave={(d) => run(() => createCustomFieldAction(jamId, fieldData(d)))}
              onCancel={() => setEditing(null)}
            />
          </li>
        ) : locked ? (
          <li className="px-3.5 py-3 text-sm text-muted-foreground">
            {fields.length === 0 ? "No custom questions." : "Questions are locked once rating starts."}
          </li>
        ) : (
          <li>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="flex h-11 w-full items-center px-3.5 text-left text-sm text-brand hover:bg-muted md:h-10"
            >
              + Add question
            </button>
          </li>
        )}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldEditor({
  initial,
  pending,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: Draft;
  pending: boolean;
  onSave: (d: Draft) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const id = useId();

  return (
    <div
      className="flex flex-col gap-3 bg-card p-3.5"
      onKeyDown={(e) => {
        // Enter would otherwise submit the surrounding jam form.
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          if (d.name.trim()) onSave(d);
        }
      }}
    >
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-name`}>Question</Label>
          <Input
            id={`${id}-name`}
            autoFocus
            value={d.name}
            maxLength={50}
            onChange={(e) => set("name", e.target.value)}
            className="h-11 bg-background px-3 md:h-9"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-type`}>Answer</Label>
          <select
            id={`${id}-type`}
            value={d.type}
            onChange={(e) => set("type", e.target.value as FieldType)}
            className="h-11 rounded-lg border border-input bg-background px-2.5 text-sm md:h-9"
          >
            {(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-desc`}>Help text</Label>
        <Input
          id={`${id}-desc`}
          value={d.description}
          maxLength={200}
          onChange={(e) => set("description", e.target.value)}
          className="h-11 bg-background px-3 md:h-9"
        />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex min-h-11 items-center gap-2 md:min-h-0">
          <input
            type="checkbox"
            checked={d.required}
            onChange={(e) => set("required", e.target.checked)}
            className="size-4 accent-brand"
          />
          Required
        </label>
        <label className="flex min-h-11 items-center gap-2 md:min-h-0">
          <input
            type="checkbox"
            checked={d.isPrivate}
            onChange={(e) => set("isPrivate", e.target.checked)}
            className="size-4 accent-brand"
          />
          Private (organizers and judges only)
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || d.name.trim() === ""}
          onClick={() => onSave(d)}
          className="h-11 px-3.5 md:h-8"
        >
          {pending ? "Saving…" : "Save question"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="h-11 px-3.5 md:h-8">
          Cancel
        </Button>
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onDelete}
            className="ml-auto h-11 px-3.5 text-destructive md:h-8"
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
