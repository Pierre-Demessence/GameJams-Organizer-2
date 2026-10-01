import { Check as CheckIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { Check } from "@/lib/jam-form";
import { cn } from "@/lib/utils";

// Shared building blocks of the long editor pages (host a jam, submission editor): numbered
// sections, labelled fields and the readiness checklist in the side panel.

export const FIELD = "h-11 bg-card px-3 md:h-10";
export const HINT = "text-xs text-subtle-foreground";

export function Checklist({ checks }: { checks: Check[] }) {
  return (
    <ul className="flex flex-col gap-2.5 text-sm">
      {checks.map((c) => (
        <li key={c.key} className="flex items-start gap-2.5">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border-[1.5px]",
              c.state === "done" && "border-live bg-live text-background",
              c.state === "todo" && "border-input",
              c.state === "optional" && "border-dashed border-input"
            )}
          >
            {c.state === "done" && <CheckIcon className="size-3" strokeWidth={3} />}
          </span>
          <a
            href={`#${c.section}`}
            className={cn("flex-1 hover:underline", c.state === "done" ? "text-foreground" : "text-muted-foreground")}
          >
            {c.label}
            {c.hint && c.state === "todo" && (
              <span className="block text-xs text-subtle-foreground">{c.hint}</span>
            )}
            <span className="sr-only">
              {c.state === "done" ? " (done)" : c.state === "todo" ? " (to do)" : " (recommended)"}
            </span>
          </a>
          {c.state === "optional" && <span className={HINT}>Recommended</span>}
        </li>
      ))}
    </ul>
  );
}

export function Section({
  id,
  title,
  description,
  first,
  hidden,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  first?: boolean;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      hidden={hidden}
      aria-labelledby={`${id}-title`}
      className={cn("flex scroll-mt-6 flex-col gap-4.5", !first && "border-t pt-8")}
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  optional,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="font-normal text-subtle-foreground"> · optional</span>}
      </Label>
      {children}
      {hint && <p className={HINT}>{hint}</p>}
    </div>
  );
}

export function CheckField({
  name,
  defaultChecked,
  label,
  help,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  help: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-brand"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        <span className="text-[13px] text-muted-foreground">{help}</span>
      </span>
    </label>
  );
}
