"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";

export const AUTH_FIELD = "h-11 bg-card px-3 md:h-10";

// Sign in and sign up are separate routes (Auth.js points `newUser` at /sign-up), shown as
// two tabs of one panel; the tabs carry the callback along.
export function AuthShell({
  mode,
  callbackUrl,
  children,
}: {
  mode: "sign-in" | "sign-up";
  callbackUrl: string;
  children: React.ReactNode;
}) {
  const signingUp = mode === "sign-up";
  const query = callbackUrl === "/" ? "" : `?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const tabs = [
    { href: `/sign-in${query}`, label: "Sign in", active: !signingUp },
    { href: `/sign-up${query}`, label: "Create account", active: signingUp },
  ];

  return (
    <div className="flex justify-center px-4 pt-10 pb-16 md:pt-20">
      <div className="flex w-full max-w-100 flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-[26px] font-semibold tracking-tight">
            {signingUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {signingUp ? "Join jams, submit games and rate entries." : "Sign in to join jams and rate games."}
          </p>
        </div>

        <nav aria-label="Account" className="grid grid-cols-2 gap-0.5 rounded-[9px] border bg-card p-[3px]">
          {tabs.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              replace
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center justify-center rounded-md text-[13px] font-medium md:h-8",
                t.active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => signIn("discord", { callbackUrl })}
          className="flex h-11 items-center justify-center gap-2.5 rounded-lg bg-discord text-[15px] font-semibold text-white outline-none hover:bg-discord/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Continue with Discord
        </button>

        <div className="flex items-center gap-3 text-xs text-subtle-foreground">
          <span aria-hidden className="h-px flex-1 bg-border" />
          or with email
          <span aria-hidden className="h-px flex-1 bg-border" />
        </div>

        {children}

        <p className="text-center text-xs leading-relaxed text-subtle-foreground">
          Free, forever. We never host your games: you link them from itch.io.
        </p>
      </div>
    </div>
  );
}
