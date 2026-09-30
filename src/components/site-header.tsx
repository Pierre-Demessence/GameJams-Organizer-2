"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MenuIcon, SearchIcon, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { ThemeButtons } from "@/components/theme-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const SHEET_LINK = "flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-muted";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const signedIn = Boolean(session?.user);
  const links = [
    {
      href: "/jams",
      label: "Jams",
      active: pathname === "/jams" || (pathname.startsWith("/jams/") && pathname !== "/jams/new"),
    },
    { href: "/jams/new", label: "Host a jam", active: pathname === "/jams/new" },
    ...(session?.user?.isStaff
      ? [{ href: "/admin", label: "Admin", active: pathname.startsWith("/admin") }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 pr-2 pl-4 md:h-15 md:px-12">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground",
                l.active && "bg-muted text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <Link
            href="/jams"
            className="hidden h-9 w-60 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-subtle-foreground md:flex"
          >
            <SearchIcon className="size-4" />
            Search jams…
          </Link>
          <Link
            href="/jams"
            aria-label="Search jams"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "size-11 md:hidden")}
          >
            <SearchIcon />
          </Link>
          {status === "loading" ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-muted" aria-hidden />
          ) : session?.user ? (
            <UserMenu user={session.user} />
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggle />
              <Link href="/sign-in" className={cn(buttonVariants({ variant: "ghost" }), "h-9")}>
                Sign in
              </Link>
              <Link href="/sign-up" className={cn(buttonVariants(), "h-9 px-3.5")}>
                Sign up
              </Link>
            </div>
          )}
          <Sheet>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Open menu"
                  className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "size-11 md:hidden")}
                />
              }
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="right" showCloseButton={false} className="data-[side=right]:w-72">
              <div className="flex items-center justify-between pl-4 pr-2 pt-2">
                <SheetTitle>Menu</SheetTitle>
                <SheetClose
                  aria-label="Close menu"
                  className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "size-11")}
                >
                  <XIcon />
                </SheetClose>
              </div>
              <nav aria-label="Mobile" className="flex flex-col p-2">
                {links.map((l) => (
                  <SheetClose nativeButton={false} key={l.href} render={<Link href={l.href} className={SHEET_LINK} />}>
                    {l.label}
                  </SheetClose>
                ))}
                {!signedIn && status !== "loading" && (
                  <>
                    <SheetClose nativeButton={false} render={<Link href="/sign-in" className={SHEET_LINK} />}>
                      Sign in
                    </SheetClose>
                    <SheetClose nativeButton={false} render={<Link href="/sign-up" className={SHEET_LINK} />}>
                      Sign up
                    </SheetClose>
                  </>
                )}
              </nav>
              {!signedIn && status !== "loading" && <ThemeButtons />}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
