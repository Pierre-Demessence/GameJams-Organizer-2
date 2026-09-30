import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LinkTab {
  href: string;
  label: string;
  count?: number;
  active: boolean;
}

// Tabs are real links: each tab is its own URL, so the server renders the selected view.
export function LinkTabs({ label, tabs }: { label: string; tabs: LinkTab[] }) {
  return (
    <div className="relative -mx-4 md:mx-0">
      <nav
        aria-label={label}
        className="no-scrollbar flex gap-1 overflow-x-auto border-b px-4 md:px-0"
      >
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-sm transition-colors",
              t.active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="font-mono text-xs text-subtle-foreground">{t.count}</span>
            )}
          </Link>
        ))}
      </nav>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background md:hidden"
      />
    </div>
  );
}
