"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCountdown } from "@/lib/jam-status-display";
import { cn } from "@/lib/utils";

export function Countdown({ to, className }: { to: string; className?: string }) {
  const router = useRouter();
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  const refreshed = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    refreshed.current = false;
  }, [target]);

  useEffect(() => {
    // The phase is derived from dates on the server; re-render once the deadline passes.
    if (now >= target && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [now, target, router]);

  return (
    // Server and client clocks differ by a second or so; the client value wins.
    <time dateTime={to} suppressHydrationWarning className={cn("font-mono tabular-nums", className)}>
      {formatCountdown(target - now)}
    </time>
  );
}
