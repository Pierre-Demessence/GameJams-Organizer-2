"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDownIcon, LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeMenuItems } from "@/components/theme-menu-items";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const display = user.username ?? user.name ?? user.email ?? "?";
  const initials = display.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full py-0 text-sm hover:bg-muted aria-expanded:bg-muted sm:border sm:border-border sm:pr-2 sm:pl-1 md:min-h-9"
      >
        <Avatar className="size-7">
          <AvatarImage src={user.image ?? undefined} alt="" />
          <AvatarFallback className="text-xs text-brand">{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate sm:inline">{display}</span>
        <ChevronDownIcon aria-hidden className="hidden size-3.5 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex flex-col gap-0.5 px-2 py-2">
          {user.name && <p className="text-sm font-semibold">{user.name}</p>}
          {user.username && (
            <p className="text-xs text-subtle-foreground">@{user.username}</p>
          )}
        </div>
        <DropdownMenuSeparator />
        {user.username && (
          <DropdownMenuItem render={<Link href={`/users/${user.username}`} />}>
            <UserIcon />
            Your profile
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href="/settings" />}>
          <SettingsIcon />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ThemeMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
