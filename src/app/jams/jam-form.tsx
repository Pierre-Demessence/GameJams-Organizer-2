"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createJamAction, updateJamAction } from "@/app/jams/actions";

interface JamFormProps {
  mode: "create" | "edit";
  jam?: {
    id: string;
    name: string;
    slug: string;
    shortDesc: string;
    fullDesc: string;
    coverUrl: string | null;
    hashtag: string | null;
    tags: string[];
    ranked: boolean;
    startDate: Date | null;
    endDate: Date | null;
    ratingEnd: Date | null;
    theme: string | null;
    revealThemeOnStart: boolean;
    hideResults: boolean;
    hideSubmissionsBeforeEnd: boolean;
    submissionDetails: string | null;
    maxTeamSize: number | null;
    allowContributorsAfterClose: boolean;
    ratingEligibility: string;
    visibility: string;
  };
}

function toDatetimeLocalValue(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function JamForm({ mode, jam }: JamFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [ranked, setRanked] = useState(jam?.ranked ?? false);
  const [revealThemeOnStart, setRevealThemeOnStart] = useState(
    jam?.revealThemeOnStart ?? false
  );
  const [hideResults, setHideResults] = useState(jam?.hideResults ?? false);
  const [hideSubmissionsBeforeEnd, setHideSubmissionsBeforeEnd] = useState(
    jam?.hideSubmissionsBeforeEnd ?? false
  );
  const [allowContributorsAfterClose, setAllowContributorsAfterClose] =
    useState(jam?.allowContributorsAfterClose ?? false);
  const [visibility, setVisibility] = useState(jam?.visibility ?? "UNLISTED");
  const [ratingEligibility, setRatingEligibility] = useState(
    jam?.ratingEligibility ?? "SUBMITTERS_AND_CONTRIBUTORS"
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    formData.set("ranked", String(ranked));
    formData.set("revealThemeOnStart", String(revealThemeOnStart));
    formData.set("hideResults", String(hideResults));
    formData.set("hideSubmissionsBeforeEnd", String(hideSubmissionsBeforeEnd));
    formData.set(
      "allowContributorsAfterClose",
      String(allowContributorsAfterClose)
    );
    formData.set("visibility", visibility);
    formData.set("ratingEligibility", ratingEligibility);

    const startLocal = formData.get("startDate") as string;
    const endLocal = formData.get("endDate") as string;
    const ratingEndLocal = formData.get("ratingEnd") as string;
    if (startLocal?.trim()) {
      const d = new Date(startLocal);
      if (!isNaN(d.getTime())) formData.set("startDate", d.toISOString());
      else formData.delete("startDate");
    }
    if (endLocal?.trim()) {
      const d = new Date(endLocal);
      if (!isNaN(d.getTime())) formData.set("endDate", d.toISOString());
      else formData.delete("endDate");
    }
    if (ratingEndLocal?.trim()) {
      const d = new Date(ratingEndLocal);
      if (!isNaN(d.getTime())) formData.set("ratingEnd", d.toISOString());
      else formData.delete("ratingEnd");
    }

    const result =
      mode === "create"
        ? await createJamAction(formData)
        : await updateJamAction(jam!.id, formData);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if ("slug" in result && result.slug) {
      router.push(`/jams/${result.slug}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
          <CardDescription>Name, description, and identity of your jam.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={100}
              defaultValue={jam?.name ?? ""}
              placeholder="My Awesome Game Jam"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              name="slug"
              required
              maxLength={60}
              defaultValue={jam?.slug ?? ""}
              placeholder="my-awesome-game-jam"
              pattern="^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens. Used in the URL.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shortDesc">Short Description *</Label>
            <Input
              id="shortDesc"
              name="shortDesc"
              required
              maxLength={280}
              defaultValue={jam?.shortDesc ?? ""}
              placeholder="A brief summary of your jam (shown in listings)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullDesc">Full Description *</Label>
            <Textarea
              id="fullDesc"
              name="fullDesc"
              required
              maxLength={50000}
              rows={8}
              defaultValue={jam?.fullDesc ?? ""}
              placeholder="Detailed description of your jam."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverUrl">Cover Image URL</Label>
            <Input
              id="coverUrl"
              name="coverUrl"
              type="url"
              defaultValue={jam?.coverUrl ?? ""}
              placeholder="https://example.com/cover.png"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hashtag">Hashtag</Label>
              <Input
                id="hashtag"
                name="hashtag"
                maxLength={50}
                defaultValue={jam?.hashtag ?? ""}
                placeholder="#MyJam2025"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                defaultValue={jam?.tags?.join(", ") ?? ""}
                placeholder="2d, pixel-art, horror (comma-separated)"
              />
              <p className="text-xs text-muted-foreground">Max 10 tags.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>Set dates to control the jam lifecycle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(jam?.startDate ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                name="endDate"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(jam?.endDate ?? null)}
              />
            </div>
          </div>
          {ranked && (
            <div className="space-y-2">
              <Label htmlFor="ratingEnd">Rating End Date</Label>
              <Input
                id="ratingEnd"
                name="ratingEnd"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(jam?.ratingEnd ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Required for ranked jams.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Jam behavior and visibility options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Ranked</Label>
              <p className="text-xs text-muted-foreground">
                Enable rating period after submissions close.
              </p>
            </div>
            <Switch checked={ranked} onCheckedChange={setRanked} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Visibility</Label>
              <p className="text-xs text-muted-foreground">
                Public jams appear in listings. Unlisted jams are only accessible via direct link.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={visibility === "UNLISTED" ? "default" : "outline"}
                size="sm"
                onClick={() => setVisibility("UNLISTED")}
              >
                Unlisted
              </Button>
              <Button
                type="button"
                variant={visibility === "PUBLIC" ? "default" : "outline"}
                size="sm"
                onClick={() => setVisibility("PUBLIC")}
              >
                Public
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Input
              id="theme"
              name="theme"
              maxLength={200}
              defaultValue={jam?.theme ?? ""}
              placeholder="The theme for this jam"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Reveal Theme on Start</Label>
              <p className="text-xs text-muted-foreground">
                Keep theme hidden until the jam begins.
              </p>
            </div>
            <Switch
              checked={revealThemeOnStart}
              onCheckedChange={setRevealThemeOnStart}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Hide Results</Label>
              <p className="text-xs text-muted-foreground">
                Hide final results from public view.
              </p>
            </div>
            <Switch checked={hideResults} onCheckedChange={setHideResults} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Hide Submissions Before End</Label>
              <p className="text-xs text-muted-foreground">
                Keep submissions private until the jam ends.
              </p>
            </div>
            <Switch
              checked={hideSubmissionsBeforeEnd}
              onCheckedChange={setHideSubmissionsBeforeEnd}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submission Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Settings</CardTitle>
          <CardDescription>Rules for how submissions work.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maxTeamSize">Max Team Size</Label>
            <Input
              id="maxTeamSize"
              name="maxTeamSize"
              type="number"
              min={1}
              defaultValue={jam?.maxTeamSize ?? ""}
              placeholder="Leave blank for unlimited"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Allow Contributors After Close</Label>
              <p className="text-xs text-muted-foreground">
                Let teams add members after submissions close.
              </p>
            </div>
            <Switch
              checked={allowContributorsAfterClose}
              onCheckedChange={setAllowContributorsAfterClose}
            />
          </div>
          {ranked && (
            <div className="space-y-2">
              <Label>Rating Eligibility</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "SUBMITTERS_ONLY", label: "Submitters Only" },
                  {
                    value: "SUBMITTERS_AND_CONTRIBUTORS",
                    label: "Submitters & Contributors",
                  },
                  { value: "JUDGES_ONLY", label: "Judges Only" },
                  { value: "EVERYONE", label: "Everyone" },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      ratingEligibility === opt.value ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setRatingEligibility(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="submissionDetails">Submission Guidelines</Label>
            <Textarea
              id="submissionDetails"
              name="submissionDetails"
              maxLength={5000}
              rows={4}
              defaultValue={jam?.submissionDetails ?? ""}
              placeholder="Instructions for submitters (what to include, format requirements, etc.)"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create Jam"
              : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
