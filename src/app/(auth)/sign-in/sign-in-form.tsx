"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeCallbackPath } from "@/lib/safe-url";
import { signInSchema } from "@/lib/validations";
import { AUTH_FIELD, AuthShell } from "../auth-shell";
import { signInAction } from "./actions";

export function SignInForm() {
  const router = useRouter();
  const { update } = useSession();
  const callbackUrl = safeCallbackPath(useSearchParams().get("callbackUrl"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    const result = await signInAction(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    await update();
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <AuthShell mode="sign-in" callbackUrl={callbackUrl}>
      <form onSubmit={handleCredentials} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            className={AUTH_FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={AUTH_FIELD}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="mt-1 h-11 text-[15px] font-semibold md:h-10.5">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
