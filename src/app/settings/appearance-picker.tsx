"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: "system",
    label: "System",
    preview: "bg-[linear-gradient(90deg,var(--color-preview-dark)_50%,var(--color-preview-light)_50%)]",
  },
  { value: "dark", label: "Dark", preview: "bg-preview-dark" },
  { value: "light", label: "Light", preview: "bg-preview-light" },
] as const;

const emptySubscribe = () => () => {};

export function AppearancePicker() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known on the client; render nothing selected until then.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  return (
    <div role="group" aria-label="Theme" className="grid grid-cols-3 gap-2 md:gap-3">
      {OPTIONS.map((o) => {
        const checked = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={checked}
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex flex-col gap-2.5 rounded-[10px] border bg-card p-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:p-3",
              checked ? "border-brand" : "hover:border-input"
            )}
          >
            <span aria-hidden className={cn("h-12 rounded-md border md:h-16", o.preview)} />
            <span className="text-sm font-medium">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
