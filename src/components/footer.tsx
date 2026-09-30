import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-subtle-foreground md:flex-row md:items-center md:gap-3 md:px-12">
        <p className="md:flex-1">
          GameJam Organizer — free for everyone. We link to your games; we never host them.
        </p>
        <nav aria-label="Footer" className="flex gap-5">
          <Link href="/jams" className="flex min-h-11 items-center hover:text-foreground md:min-h-0">Jams</Link>
          <Link href="/jams/new" className="flex min-h-11 items-center hover:text-foreground md:min-h-0">Host a jam</Link>
          <a
            href="https://github.com/Pierre-Demessence/GameJams-Organizer-2"
            className="flex min-h-11 items-center hover:text-foreground md:min-h-0"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
