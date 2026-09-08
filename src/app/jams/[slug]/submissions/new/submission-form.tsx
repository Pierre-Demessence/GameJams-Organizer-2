"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createSubmissionAction,
  updateSubmissionAction,
} from "@/app/submissions/actions";

interface CustomFieldDef {
  id: string;
  name: string;
  description: string | null;
  type: "SINGLE_LINE" | "MULTI_LINE" | "URL";
  required: boolean;
}

interface SubmissionFormProps {
  jamSlug: string;
  customFields: CustomFieldDef[];
  mode: "create" | "edit";
  submission?: {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    itchUrl: string | null;
    supportedPlatforms: string[];
    screenshots: string[];
    videoUrl: string | null;
    fieldValues: { fieldId: string; value: string }[];
  };
}

const PLATFORM_OPTIONS = [
  { value: "WINDOWS", label: "Windows" },
  { value: "MAC", label: "Mac" },
  { value: "LINUX", label: "Linux" },
  { value: "WEB", label: "Web" },
] as const;

export function SubmissionForm({
  jamSlug,
  customFields,
  mode,
  submission,
}: SubmissionFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const result =
      mode === "create"
        ? await createSubmissionAction(jamSlug, formData)
        : await updateSubmissionAction(submission!.id, formData);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if ("submissionId" in result && result.submissionId) {
      router.push(`/submissions/${result.submissionId}`);
    } else {
      router.push(`/submissions/${submission!.id}`);
    }
  }

  function getFieldValue(fieldId: string): string {
    return submission?.fieldValues?.find((fv) => fv.fieldId === fieldId)?.value ?? "";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Submission Details</CardTitle>
          <CardDescription>Basic info about your entry.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={100}
              defaultValue={submission?.title ?? ""}
              placeholder="My Game"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              maxLength={50000}
              rows={6}
              defaultValue={submission?.description ?? ""}
              placeholder="Describe your game..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverUrl">Cover Image URL</Label>
            <Input
              id="coverUrl"
              name="coverUrl"
              type="url"
              defaultValue={submission?.coverUrl ?? ""}
              placeholder="https://example.com/cover.png"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="videoUrl">Video URL</Label>
            <Input
              id="videoUrl"
              name="videoUrl"
              type="url"
              defaultValue={submission?.videoUrl ?? ""}
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="screenshots">Screenshots (comma-separated URLs)</Label>
            <Input
              id="screenshots"
              name="screenshots"
              defaultValue={submission?.screenshots?.join(", ") ?? ""}
              placeholder="https://example.com/ss1.png, https://example.com/ss2.png"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Game Link</CardTitle>
          <CardDescription>
            Your itch.io project page. Ownership is verified after saving; builds
            for each platform live on itch.io.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itchUrl">itch.io Project URL</Label>
            <Input
              id="itchUrl"
              name="itchUrl"
              type="url"
              defaultValue={submission?.itchUrl ?? ""}
              placeholder="https://yourname.itch.io/your-game"
            />
          </div>
          <div className="space-y-2">
            <Label>Supported Platforms</Label>
            <div className="flex flex-wrap gap-4">
              {PLATFORM_OPTIONS.map((p) => (
                <label
                  key={p.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="platforms"
                    value={p.value}
                    defaultChecked={submission?.supportedPlatforms?.includes(
                      p.value
                    )}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {customFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Fields</CardTitle>
            <CardDescription>
              Extra information requested by the organizers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {customFields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={`custom_${field.id}`}>
                  {field.name}
                  {field.required && " *"}
                </Label>
                {field.description && (
                  <p className="text-xs text-muted-foreground">
                    {field.description}
                  </p>
                )}
                {field.type === "MULTI_LINE" ? (
                  <Textarea
                    id={`custom_${field.id}`}
                    name={`custom_${field.id}`}
                    required={field.required}
                    rows={4}
                    defaultValue={getFieldValue(field.id)}
                  />
                ) : (
                  <Input
                    id={`custom_${field.id}`}
                    name={`custom_${field.id}`}
                    type={field.type === "URL" ? "url" : "text"}
                    required={field.required}
                    defaultValue={getFieldValue(field.id)}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Saving..."
            : mode === "create"
              ? "Save Draft"
              : "Update Entry"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
