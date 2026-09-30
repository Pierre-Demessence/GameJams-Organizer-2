import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex min-h-11 items-center gap-2.5 font-semibold tracking-tight">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
        <rect x="12" y="12" width="6" height="6" rx="1.5" className="fill-brand" />
      </svg>
      <span>GameJam Organizer</span>
    </Link>
  );
}
