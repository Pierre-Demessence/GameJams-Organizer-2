"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

const emptySubscribe = () => () => {};

export function ThemeButtons() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return (
    <div role="group" aria-label="Theme" className="flex flex-col gap-1 p-2">
      <span className="px-3 text-xs text-subtle-foreground">Theme</span>
      <div className="flex gap-1">
        {THEMES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={mounted && theme === value}
            onClick={() => setTheme(value)}
            className={cn(
              "min-h-11 flex-1 rounded-md border px-2 text-sm hover:bg-muted",
              mounted && theme === value && "bg-muted font-medium"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
