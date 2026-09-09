"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { buttonVariants } from "@/components/ui/button-variants";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  const { data: session, status } = useSession();
  const staff = session?.user?.isStaff ?? false;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/" className="mr-6 flex items-center space-x-2 font-bold">
          <span>🎮 GameJam Organizer</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/jams"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Browse Jams
          </Link>
          {staff && (
            <Link
              href="/admin"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {status === "loading" ? (
            <div
              className="h-8 w-8 animate-pulse rounded-full bg-muted"
              aria-hidden
            />
          ) : session?.user ? (
            <UserMenu user={session.user} />
          ) : (
            <>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className={buttonVariants({ size: "sm" })}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
