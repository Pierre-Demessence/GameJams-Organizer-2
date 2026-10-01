"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeCallbackPath } from "@/lib/safe-url";
import { signUpSchema } from "@/lib/validations";
import { AUTH_FIELD, AuthShell } from "../auth-shell";
import { signUpAction } from "./actions";

export function SignUpForm() {
  const router = useRouter();
  const { update } = useSession();
  const callbackUrl = safeCallbackPath(useSearchParams().get("callbackUrl"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      username: formData.get("username") as string,
    };
    const parsed = signUpSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    const result = await signUpAction(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    if (signInResult?.error) {
      router.push(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    await update();
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <AuthShell mode="sign-up" callbackUrl={callbackUrl}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="pixelmira"
            required
            autoComplete="username"
            minLength={3}
            maxLength={30}
            aria-describedby="username-hint"
            className={AUTH_FIELD}
          />
          <p id="username-hint" className="text-xs text-subtle-foreground">
            Lowercase letters, numbers, - and _. Used in your profile URL.
          </p>
        </div>
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
            minLength={8}
            autoComplete="new-password"
            aria-describedby="password-hint"
            className={AUTH_FIELD}
          />
          <p id="password-hint" className="text-xs text-subtle-foreground">
            At least 8 characters with a letter and a number.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="mt-1 h-11 text-[15px] font-semibold md:h-10.5">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
