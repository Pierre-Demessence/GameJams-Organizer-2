"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createCustomFieldAction,
  updateCustomFieldAction,
  deleteCustomFieldAction,
} from "./custom-field-actions";
import { useRouter } from "next/navigation";

interface CustomField {
  id: string;
  name: string;
  description: string | null;
  type: string;
  required: boolean;
  isPrivate: boolean;
  sortOrder: number;
}

interface CustomFieldsManagerProps {
  jamId: string;
  fields: CustomField[];
  locked: boolean;
}

export function CustomFieldsManager({
  jamId,
  fields,
  locked,
}: CustomFieldsManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await createCustomFieldAction(jamId, formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setShowForm(false);
      router.refresh();
    }
  }

  async function handleUpdate(fieldId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateCustomFieldAction(fieldId, jamId, formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setEditingId(null);
      router.refresh();
    }
  }

  async function handleDelete(fieldId: string) {
    setError("");
    setLoading(true);
    const result = await deleteCustomFieldAction(fieldId, jamId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Custom Submission Fields</CardTitle>
          {!locked && !showForm && (
            <Button
              type="button"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              Add Field
            </Button>
          )}
        </div>
        {locked && (
          <p className="text-sm text-muted-foreground">
            Fields are locked after the submission period ends.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {fields.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground">
            No custom fields defined yet.
          </p>
        )}

        {fields.map((field) =>
          editingId === field.id ? (
            <FieldForm
              key={field.id}
              field={field}
              loading={loading}
              onSubmit={(e) => handleUpdate(field.id, e)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={field.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{field.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {field.type.replace("_", " ")}
                  </Badge>
                  {field.required && (
                    <Badge variant="secondary" className="text-xs">
                      Required
                    </Badge>
                  )}
                  {field.isPrivate && (
                    <Badge variant="secondary" className="text-xs">
                      Private
                    </Badge>
                  )}
                </div>
                {field.description && (
                  <p className="text-sm text-muted-foreground">
                    {field.description}
                  </p>
                )}
              </div>
              {!locked && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(field.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(field.id)}
                    disabled={loading}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )
        )}

        {showForm && (
          <FieldForm
            loading={loading}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function FieldForm({
  field,
  loading,
  onSubmit,
  onCancel,
}: {
  field?: CustomField;
  loading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [required, setRequired] = useState(field?.required ?? false);
  const [isPrivate, setIsPrivate] = useState(field?.isPrivate ?? false);
  const [type, setType] = useState(field?.type ?? "SINGLE_LINE");

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border p-3">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input
          name="name"
          required
          maxLength={50}
          defaultValue={field?.name ?? ""}
          placeholder="Field name"
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          name="description"
          maxLength={200}
          defaultValue={field?.description ?? ""}
          placeholder="Brief description"
        />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <div className="flex gap-1">
          {(["SINGLE_LINE", "MULTI_LINE", "URL"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={type === t ? "default" : "outline"}
              size="sm"
              onClick={() => setType(t)}
            >
              {t.replace("_", " ")}
            </Button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={required} onCheckedChange={setRequired} />
          <Label>Required</Label>
          <input type="hidden" name="required" value={String(required)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          <Label>Private</Label>
          <input type="hidden" name="isPrivate" value={String(isPrivate)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : field ? "Update" : "Add Field"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
