import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

// Covers are external URLs (spec §2: no hosted assets); no-referrer keeps the viewer's
// page URL away from third-party image hosts.
export function CoverImage({
  src,
  alt,
  name,
  className,
}: {
  src: string | null;
  alt: string;
  name: string;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "flex items-center justify-center bg-muted bg-[radial-gradient(var(--input)_1px,transparent_1px)] [background-size:14px_14px] font-semibold text-subtle-foreground",
        className
      )}
    >
      <span aria-hidden>{initials(name)}</span>
    </div>
  );
}
