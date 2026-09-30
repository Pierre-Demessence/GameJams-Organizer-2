"use client";

import { useTheme } from "next-themes";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="text-xs text-subtle-foreground">Theme</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme ?? "dark"} onValueChange={(v) => setTheme(String(v))}>
        {OPTIONS.map((o) => (
          <DropdownMenuRadioItem key={o.value} value={o.value}>
            {o.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}
