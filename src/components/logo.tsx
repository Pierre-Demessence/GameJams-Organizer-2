import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2 font-semibold tracking-tight md:gap-2.5">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
        <rect x="12" y="12" width="6" height="6" rx="1.5" className="fill-brand" />
      </svg>
      <span className="whitespace-nowrap text-[15px] md:text-base">GameJam Organizer</span>
    </Link>
  );
}
