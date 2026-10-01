"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initials } from "@/lib/initials";
import { safeHttpUrl } from "@/lib/safe-url";
import { updateProfileAction } from "./profile-actions";

export const FIELD = "h-11 bg-card px-3 md:h-10";
const HINT = "text-xs text-subtle-foreground";

interface ProfileFormProps {
  user: {
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { update } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [username, setUsername] = useState(user.username);
  const preview = safeHttpUrl(avatarUrl);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const result = await updateProfileAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Profile saved");
      // The header reads the name and avatar from the session token.
      await update().catch(() => undefined);
    } catch {
      setError("Could not save your profile. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
      <div className="flex items-start gap-4.5">
        <Avatar className="mt-6 size-16 border border-input">
          {preview && <AvatarImage src={preview} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="bg-muted text-xl font-semibold text-brand">
            {initials(user.displayName ?? user.username)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            name="avatarUrl"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
            aria-describedby="avatarUrl-hint"
            className={FIELD}
          />
          <p id="avatarUrl-hint" className={HINT}>
            We don&apos;t host images. Link one from Gravatar, GitHub, Imgur…
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={user.displayName ?? ""}
            maxLength={50}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9_\-]+"
            aria-describedby="username-hint"
            className={`${FIELD} font-mono text-[13px] md:text-[13px]`}
          />
          <p id="username-hint" className={HINT}>
            Your profile lives at /users/{username || "…"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={user.bio ?? ""}
          maxLength={500}
          rows={3}
          className="bg-card px-3 py-2.5 leading-relaxed"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="h-11 w-full px-4 font-semibold md:h-9.5 md:w-auto">
          {loading ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
