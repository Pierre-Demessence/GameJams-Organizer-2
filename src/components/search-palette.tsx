"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, CornerDownLeft, SearchIcon, XIcon } from "lucide-react";
import { JamStatusBadge } from "@/components/jam/jam-status-badge";
import { buttonVariants } from "@/components/ui/button-variants";
import type { JamPhase } from "@/domain/jam-phase";
import { searchJamsAction } from "@/app/search-actions";
import { normalizeQuery } from "@/lib/search";
import { cn } from "@/lib/utils";

interface Hit {
  slug: string;
  name: string;
  shortDesc: string;
  phase: JamPhase;
}

type Item =
  | { kind: "jam"; href: string; hit: Hit }
  | { kind: "link"; href: string; label: string };

const QUICK_LINKS: Item[] = [
  { kind: "link", href: "/jams?status=live", label: "Live jams" },
  { kind: "link", href: "/jams?status=rating", label: "Jams in rating" },
  { kind: "link", href: "/jams?status=upcoming", label: "Upcoming jams" },
  { kind: "link", href: "/jams/new", label: "Host a jam" },
];

const noSubscribe = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

// Opened from the header (field on desktop, icon on phones) or with ⌘K / Ctrl+K anywhere.
export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const mac = useSyncExternalStore(noSubscribe, isMac, () => true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.repeat) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          <button
            type="button"
            className="hidden h-9 w-60 items-center gap-2 rounded-lg border bg-card pr-2 pl-3 text-sm text-subtle-foreground hover:border-input md:flex"
          />
        }
      >
        <SearchIcon aria-hidden className="size-4" />
        <span className="flex-1 text-left">Search jams…</span>
        <kbd className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
      </Dialog.Trigger>
      <Dialog.Trigger
        render={
          <button
            type="button"
            aria-label="Search jams"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "size-11 md:hidden")}
          />
        }
      >
        <SearchIcon />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed inset-x-3 top-3 z-50 mx-auto max-w-150 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl outline-none md:top-[12vh]">
          <Dialog.Title className="sr-only">Search jams</Dialog.Title>
          {open && <PaletteBody onDone={() => setOpen(false)} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaletteBody({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; hits: Hit[]; error?: string }>({ query: "", hits: [] });
  const [active, setActive] = useState(0);
  const [isPending, startTransition] = useTransition();
  const latest = useRef("");

  const q = normalizeQuery(query);
  useEffect(() => {
    latest.current = q;
    if (!q) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await searchJamsAction(q).catch(() => ({ hits: [], error: "Search is unavailable right now." }));
        if (latest.current !== q) return;
        setResult({ query: q, hits: res.hits, error: res.error });
        setActive(0);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [q]);

  const settled = result.query === q && !isPending;
  // The previous hits stay listed (dimmed) while the next search runs, so the list doesn't jump.
  const items: Item[] = q
    ? [
        ...result.hits.map((hit) => ({ kind: "jam" as const, href: `/jams/${hit.slug}`, hit })),
        { kind: "link", href: `/jams?q=${encodeURIComponent(q)}`, label: `Search all jams for “${q}”` },
      ]
    : QUICK_LINKS;
  const current = Math.min(active, items.length - 1);

  const go = (item: Item) => {
    // Hits shown while a search is pending belong to the previous query; the "Search all" row
    // (always last) is the one that matches what was typed.
    const target = !settled && item.kind === "jam" ? items[items.length - 1] : item;
    onDone();
    router.push(target.href);
  };

  const optionId = (i: number) => `${listId}-${i}`;
  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current, listId]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b px-4">
        <SearchIcon aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={optionId(current)}
          aria-label="Search jams"
          placeholder="Search jams by name, description or tag"
          value={query}
          maxLength={100}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((current + 1) % items.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((current - 1 + items.length) % items.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(items[current]);
            }
          }}
          className="h-13 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle-foreground"
        />
        <Dialog.Close
          aria-label="Close search"
          className="-mr-2 flex min-h-11 min-w-11 items-center justify-center md:mr-0 md:min-h-0 md:min-w-0"
        >
          <span className="hidden rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground md:inline">
            Esc
          </span>
          <XIcon aria-hidden className="size-4 text-muted-foreground md:hidden" />
        </Dialog.Close>
      </div>

      {!q && (
        <p aria-hidden className="px-4 pt-3 text-xs text-subtle-foreground">
          Jump to
        </p>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label={q ? "Results" : "Jump to"}
        aria-busy={!settled}
        className={cn("max-h-[60vh] overflow-y-auto p-1.5", q && !settled && "opacity-60")}
      >
        {items.map((item, i) => (
          <li
            key={item.href}
            id={optionId(i)}
            role="option"
            aria-selected={i === current}
            onMouseMove={() => setActive(i)}
            onClick={() => go(item)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
              i === current && "bg-muted"
            )}
          >
            {item.kind === "jam" ? (
              <>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{item.hit.name}</span>
                  <span className="truncate text-xs text-subtle-foreground">{item.hit.shortDesc}</span>
                </div>
                <JamStatusBadge phase={item.hit.phase} className="shrink-0" />
              </>
            ) : (
              <>
                <span className="flex-1 truncate text-muted-foreground">{item.label}</span>
                <ArrowRight aria-hidden className="size-4 text-subtle-foreground" />
              </>
            )}
            {i === current && <CornerDownLeft aria-hidden className="hidden size-3.5 text-subtle-foreground md:block" />}
          </li>
        ))}
      </ul>

      <div aria-live="polite" className="border-t px-4 py-2 text-xs text-subtle-foreground">
        {!q
          ? "Type to search listed jams."
          : !settled || isPending
            ? "Searching…"
            : result.error
              ? result.error
              : result.hits.length === 0
                ? "No jam matches. Try the full list."
                : `${result.hits.length} ${result.hits.length === 1 ? "jam" : "jams"} · ↑↓ to move, Enter to open`}
      </div>
    </div>
  );
}
