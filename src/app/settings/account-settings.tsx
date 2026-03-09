"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { linkPasswordAction, unlinkProviderAction, changePasswordAction } from "./actions";

interface LinkedAccount {
  provider: string;
  providerAccountId: string;
}

interface AccountSettingsProps {
  hasPassword: boolean;
  email: string | null;
  linkedAccounts: LinkedAccount[];
}

export function AccountSettings({ hasPassword, email, linkedAccounts }: AccountSettingsProps) {
  const hasDiscord = linkedAccounts.some((a) => a.provider === "discord");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Linked Providers</CardTitle>
          <CardDescription>
            Manage your sign-in methods. You must keep at least one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Discord</p>
              <p className="text-sm text-muted-foreground">
                {hasDiscord ? "Connected" : "Not connected"}
              </p>
            </div>
            {hasDiscord ? (
              <UnlinkButton provider="discord" />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => signIn("discord", { callbackUrl: "/settings" })}
              >
                Link Discord
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email & Password</p>
              <p className="text-sm text-muted-foreground">
                {hasPassword ? `Configured (${email})` : "Not configured"}
              </p>
            </div>
          </div>

          {!hasPassword && <LinkPasswordForm />}
          {hasPassword && <ChangePasswordForm />}
        </CardContent>
      </Card>
    </div>
  );
}

function UnlinkButton({ provider }: { provider: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlink() {
    setLoading(true);
    setError(null);
    const result = await unlinkProviderAction(provider);
    setLoading(false);
    if (result.error) setError(result.error);
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleUnlink}
        disabled={loading}
      >
        {loading ? "Unlinking…" : "Unlink"}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function LinkPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await linkPasswordAction(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="link-email">Email</Label>
        <Input
          id="link-email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="link-password">Password</Label>
        <Input
          id="link-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Password login added.</p>}
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Linking…" : "Set Email & Password"}
      </Button>
    </form>
  );
}

function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await changePasswordAction(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="current-password">Current Password</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Password updated.</p>}
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Updating…" : "Change Password"}
      </Button>
    </form>
  );
}
