"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_FIELD } from "@/app/(auth)/auth-shell";
import { confirmEnrolmentAction, startEnrolmentAction, verifyTwoFactorAction } from "./actions";

type Setup = { key: string; qrDataUrl: string };

// The manual key is shown in groups of four so it is easy to type into an authenticator.
const groupKey = (key: string) => key.match(/.{1,4}/g)?.join(" ") ?? key;

export function TwoFactorForm({ mode, callbackUrl }: { mode: "enrol" | "verify"; callbackUrl: string }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const enrolling = mode === "enrol";

  function begin() {
    setError(null);
    startTransition(async () => {
      const result = await startEnrolmentAction();
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      setSetup(result);
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await (enrolling ? confirmEnrolmentAction : verifyTwoFactorAction)(code);
      if (result.error) {
        setError(result.error);
        setCode("");
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    });
  }

  return (
    <div className="flex justify-center px-4 pt-10 pb-16 md:pt-20">
      <div className="flex w-full max-w-100 flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-[26px] font-semibold tracking-tight">
            {enrolling ? "Set up two-factor authentication" : "Enter your two-factor code"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {enrolling
              ? "Staff access needs a code from an authenticator app, whichever way you signed in."
              : "Open your authenticator app and enter the 6-digit code for GameJam Organizer."}
          </p>
        </div>

        {enrolling && !setup && (
          <Button type="button" onClick={begin} disabled={isPending} className="h-11 text-[15px] font-semibold md:h-10.5">
            {isPending ? "Preparing…" : "Set up authenticator"}
          </Button>
        )}

        {enrolling && setup && (
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-5">
            <ol className="flex flex-col gap-1 self-stretch text-sm text-muted-foreground">
              <li>1. Scan the QR code with an authenticator app, or type the key.</li>
              <li>2. Enter the 6-digit code it shows.</li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing for next/image to optimize */}
            <img
              src={setup.qrDataUrl}
              alt="QR code to add GameJam Organizer to your authenticator app"
              width={224}
              height={224}
              className="rounded-md"
            />
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-xs text-subtle-foreground">Manual key</span>
              <code className="font-mono text-sm tracking-wider break-all select-all">{groupKey(setup.key)}</code>
            </div>
          </div>
        )}

        {(!enrolling || setup) && (
          <form onSubmit={submit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Authentication code</Label>
              <Input
                id="code"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                placeholder="123 456"
                required
                autoFocus
                className={`${AUTH_FIELD} font-mono tracking-widest`}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={isPending || !code.trim()} className="h-11 text-[15px] font-semibold md:h-10.5">
              {isPending ? "Checking…" : enrolling ? "Turn on two-factor" : "Verify"}
            </Button>
          </form>
        )}

        {enrolling && !setup && error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
