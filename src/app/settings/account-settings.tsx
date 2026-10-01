"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { changePasswordAction, linkPasswordAction, unlinkProviderAction } from "./actions";
import { FIELD } from "./profile-form";

const ROW_ACTION = "h-11 shrink-0 px-3 text-[13px] md:h-8";

export function SignInMethods({
  hasPassword,
  email,
  providers,
}: {
  hasPassword: boolean;
  email: string | null;
  providers: string[];
}) {
  const hasDiscord = providers.includes("discord");

  return (
    <ul className="rounded-xl border">
      <MethodRow
        short="DC"
        name="Discord"
        status={hasDiscord ? "Connected" : "Not connected"}
        connected={hasDiscord}
        action={
          hasDiscord ? (
            <UnlinkButton provider="discord" />
          ) : (
            <Button
              variant="outline"
              className={ROW_ACTION}
              onClick={() => signIn("discord", { callbackUrl: "/settings#sign-in" })}
            >
              Link
            </Button>
          )
        }
      />
      <MethodRow
        short="@"
        name="Email & password"
        status={hasPassword ? (email ?? "Set") : "Not set"}
        connected={hasPassword}
        action={
          <a href="#password" className={cn("inline-flex items-center rounded-lg border", ROW_ACTION)}>
            {hasPassword ? "Change" : "Set up"}
          </a>
        }
      />
      <MethodRow
        short="io"
        name="itch.io"
        status="Coming soon: verifies your games automatically"
        connected={false}
        action={
          <Button variant="outline" disabled className={ROW_ACTION}>
            Link
          </Button>
        }
        last
      />
    </ul>
  );
}

function MethodRow({
  short,
  name,
  status,
  connected,
  action,
  last,
}: {
  short: string;
  name: string;
  status: string;
  connected: boolean;
  action: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className={cn("flex items-center gap-3.5 px-4 py-3.5", !last && "border-b")}>
      <span
        aria-hidden
        className="flex size-8.5 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs font-semibold text-muted-foreground"
      >
        {short}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{name}</span>
        <span className={cn("truncate text-[13px]", connected ? "text-live" : "text-subtle-foreground")}>
          {status}
        </span>
      </div>
      {action}
    </li>
  );
}

function UnlinkButton({ provider }: { provider: string }) {
  const [loading, setLoading] = useState(false);

  async function handleUnlink() {
    setLoading(true);
    const result = await unlinkProviderAction(provider);
    setLoading(false);
    if (result.error) toast.error(result.error);
    else toast.success("Unlinked");
  }

  return (
    <Button variant="outline" onClick={handleUnlink} disabled={loading} className={ROW_ACTION}>
      {loading ? "Unlinking…" : "Unlink"}
    </Button>
  );
}

export function PasswordSection({ hasPassword, email }: { hasPassword: boolean; email: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const password = formData.get(hasPassword ? "newPassword" : "password");
    if (password !== formData.get("confirmPassword")) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    const result = hasPassword ? await changePasswordAction(formData) : await linkPasswordAction(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success(hasPassword ? "Password changed" : "Password sign-in added");
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
      <div className="flex max-w-105 flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        {hasPassword ? (
          <Input id="email" type="email" value={email ?? ""} readOnly className={FIELD} />
        ) : (
          <Input id="email" name="email" type="email" required autoComplete="email" className={FIELD} />
        )}
      </div>
      {hasPassword && (
        <div className="flex max-w-105 flex-col gap-1.5">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className={FIELD}
          />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            name={hasPassword ? "newPassword" : "password"}
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="newPassword-hint"
            className={FIELD}
          />
          <p id="newPassword-hint" className="text-xs text-subtle-foreground">
            At least 8 characters with a letter and a number.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className={FIELD}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="outline"
          disabled={loading}
          className="h-11 w-full px-4 md:h-9.5 md:w-auto"
        >
          {loading ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </Button>
      </div>
    </form>
  );
}
