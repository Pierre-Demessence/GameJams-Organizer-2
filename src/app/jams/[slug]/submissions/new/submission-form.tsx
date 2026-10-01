"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checklist, FIELD, Field, HINT, Section } from "@/components/editor";
import {
  createSubmissionAction,
  deleteSubmissionAction,
  submitSubmissionAction,
  unsubmitSubmissionAction,
  updateSubmissionAction,
  verifySubmissionAction,
} from "@/app/submissions/actions";
import { TeamManager } from "@/app/submissions/[id]/team-manager";
import { platformLabel } from "@/lib/jam-labels";
import { displayItchUrl, submitChecklist } from "@/lib/submission-form";
import { safeHttpUrl } from "@/lib/safe-url";
import { cn } from "@/lib/utils";

const FORM_ID = "submission-form";
const PLATFORMS = ["WINDOWS", "MAC", "LINUX", "WEB"] as const;
const STAMP = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

interface CustomFieldDef {
  id: string;
  name: string;
  description: string | null;
  type: "SINGLE_LINE" | "MULTI_LINE" | "URL";
  required: boolean;
  isPrivate: boolean;
}

export interface EditableSubmission {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  itchUrl: string | null;
  supportedPlatforms: string[];
  screenshots: string[];
  videoUrl: string | null;
  fieldValues: { fieldId: string; value: string }[];
  status: "DRAFT" | "SUBMITTED";
  verified: boolean;
  verificationCode: string | null;
}

type TeamProps = React.ComponentProps<typeof TeamManager>;

type SubmissionFormProps = {
  jam: { name: string; slug: string; endDate: Date | null; submissionDetails: string | null };
  customFields: CustomFieldDef[];
} & (
  | { mode: "create" }
  | {
      mode: "edit";
      submission: EditableSubmission;
      // Team-only controls (verification, submit, roster); organizers editing for moderation
      // get the form alone.
      isMember: boolean;
      canFinalize: boolean;
      canDelete: boolean;
      team: TeamProps | null;
    }
);

export function SubmissionForm(props: SubmissionFormProps) {
  const router = useRouter();
  const sub = props.mode === "edit" ? props.submission : null;
  const isMember = props.mode === "create" || props.isMember;
  const value = (fieldId: string) => sub?.fieldValues.find((v) => v.fieldId === fieldId)?.value ?? "";

  const [title, setTitle] = useState(sub?.title ?? "");
  const [description, setDescription] = useState(sub?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(sub?.coverUrl ?? "");
  const [itchUrl, setItchUrl] = useState(sub?.itchUrl ?? "");
  const [platforms, setPlatforms] = useState<string[]>(sub?.supportedPlatforms ?? []);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(props.customFields.map((f) => [f.id, value(f.id)]))
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"save" | "submit" | "withdraw" | "delete" | null>(null);

  const required = props.customFields.filter((f) => f.required);
  const { checks, ready } = submitChecklist({
    title,
    description,
    coverUrl,
    platforms: platforms.length,
    hasItchUrl: Boolean(sub?.itchUrl),
    verified: Boolean(sub?.verified) && itchUrl === (sub?.itchUrl ?? ""),
    missingRequiredFields: required.filter((f) => !answers[f.id]?.trim()).map((f) => f.name),
    hasRequiredFields: required.length > 0,
  });
  const submitted = sub?.status === "SUBMITTED";

  async function save(): Promise<string | null> {
    const form = document.getElementById(FORM_ID) as HTMLFormElement;
    if (!form.reportValidity()) return null;
    const fd = new FormData(form);
    const result =
      props.mode === "create"
        ? await createSubmissionAction(props.jam.slug, fd)
        : await updateSubmissionAction(props.submission.id, fd);
    if (result.error) {
      setError(result.error);
      return null;
    }
    return "submissionId" in result && typeof result.submissionId === "string" ? result.submissionId : sub!.id;
  }

  async function act(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setError("");
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const onSave = () =>
    act("save", async () => {
      const id = await save();
      if (!id) return;
      toast.success(props.mode === "create" ? "Draft saved" : "Saved");
      if (props.mode === "create") router.replace(`/submissions/${id}/edit`);
      else router.refresh();
    });

  const onSubmit = () =>
    act("submit", async () => {
      const id = await save();
      if (!id) return;
      const result = await submitSubmissionAction(id);
      if (result.error) {
        setError(result.error);
        router.refresh();
        return;
      }
      toast.success("Submitted to the jam");
      router.push(`/submissions/${id}`);
    });

  const onWithdraw = () =>
    act("withdraw", async () => {
      const result = await unsubmitSubmissionAction(sub!.id);
      if (result.error) setError(result.error);
      else toast.success("Back to draft");
      router.refresh();
    });

  const onDelete = () =>
    act("delete", async () => {
      if (!window.confirm("Delete this submission for the whole team? Only platform staff can restore it.")) return;
      const result = await deleteSubmissionAction(sub!.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Submission deleted");
      router.push(`/jams/${props.jam.slug}`);
    });

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-x-12 px-4 pt-6 pb-16 md:px-12 md:pt-9 lg:grid-cols-12">
      <div className="flex flex-col gap-8 lg:col-span-8">
        <div className="flex flex-col gap-2">
          <nav aria-label="Breadcrumb" className="text-[13px] text-subtle-foreground">
            <Link href={`/jams/${props.jam.slug}`} className="hover:text-foreground">
              {props.jam.name}
            </Link>{" "}
            / {isMember ? "Your submission" : "Edit submission"}
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] font-semibold tracking-tight">{title.trim() || "New submission"}</h1>
            <span
              className={cn(
                "inline-flex h-5.5 items-center rounded-md border px-2 text-xs font-medium",
                submitted ? "border-live text-live" : "border-dashed border-input text-muted-foreground"
              )}
            >
              {submitted ? "Submitted" : "Draft"}
            </span>
          </div>
        </div>

        {props.jam.submissionDetails && (
          <div className="rounded-xl border bg-card px-5 py-4.5 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            <strong className="font-semibold text-foreground">From the organizers:</strong>{" "}
            {props.jam.submissionDetails}
          </div>
        )}

        <form
          id={FORM_ID}
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
          className="flex flex-col gap-8"
        >
          <Section
            id="itch"
            title="itch.io page"
            description="Your game lives on itch.io. Prove it's yours and it can go live in the jam."
            first
          >
            <Field label="Project URL" htmlFor="itchUrl" hint={sub?.itchUrl && itchUrl !== sub.itchUrl ? "Changing the link returns the entry to draft and needs a new check." : undefined}>
              <Input
                id="itchUrl"
                name="itchUrl"
                type="url"
                placeholder="https://you.itch.io/your-game"
                value={itchUrl}
                onChange={(e) => setItchUrl(e.target.value)}
                className={cn(FIELD, "font-mono text-[13px] md:text-[13px]")}
              />
            </Field>
            {isMember && (
              <VerificationCard
                submissionId={sub?.id ?? null}
                savedUrl={sub?.itchUrl ?? null}
                currentUrl={itchUrl}
                code={sub?.verificationCode ?? null}
                verified={sub?.verified ?? false}
              />
            )}
          </Section>

          <Section id="details" title="Game details">
            <Field label="Title" htmlFor="title">
              <Input
                id="title"
                name="title"
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={FIELD}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">
                Description <span className="font-normal text-subtle-foreground">· Markdown</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                maxLength={50000}
                rows={7}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-card px-3 py-2.5 font-mono text-[13px] leading-relaxed md:text-[13px]"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cover image URL" htmlFor="coverUrl">
                <Input
                  id="coverUrl"
                  name="coverUrl"
                  type="url"
                  placeholder="https://img.itch.zone/…"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className={FIELD}
                />
              </Field>
              <Field label="Video link" optional htmlFor="videoUrl">
                <Input
                  id="videoUrl"
                  name="videoUrl"
                  type="url"
                  placeholder="YouTube, Twitch…"
                  defaultValue={sub?.videoUrl ?? ""}
                  className={FIELD}
                />
              </Field>
            </div>
            <Field label="Screenshot URLs" optional htmlFor="screenshots" hint="Separate links with commas.">
              <Input
                id="screenshots"
                name="screenshots"
                defaultValue={sub?.screenshots.join(", ") ?? ""}
                className={FIELD}
              />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[13px] font-medium">Runs on</legend>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const on = platforms.includes(p);
                  return (
                    <label
                      key={p}
                      className={cn(
                        "flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-sm md:h-9.5",
                        on ? "border-input bg-muted" : "hover:border-input"
                      )}
                    >
                      <input
                        type="checkbox"
                        name="platforms"
                        value={p}
                        checked={on}
                        onChange={(e) =>
                          setPlatforms((prev) => (e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)))
                        }
                        className="size-4 accent-brand"
                      />
                      {platformLabel(p)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Section>

          {props.customFields.length > 0 && (
            <Section id="questions" title="Jam questions" description="Asked by the organizers of this jam.">
              {props.customFields.map((f) => {
                const id = `custom_${f.id}`;
                const common = {
                  id,
                  name: id,
                  required: f.required,
                  value: answers[f.id] ?? "",
                  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                    setAnswers((prev) => ({ ...prev, [f.id]: e.target.value })),
                  "aria-describedby": f.description ? `${id}-hint` : undefined,
                };
                return (
                  <div key={f.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={id}>
                      {f.name}
                      {f.required && (
                        <span aria-hidden className="text-destructive">
                          {" "}
                          *
                        </span>
                      )}
                      {f.isPrivate && (
                        <span className="font-normal text-subtle-foreground">
                          {" "}
                          · private: organizers and judges only
                        </span>
                      )}
                    </Label>
                    {f.type === "MULTI_LINE" ? (
                      <Textarea {...common} rows={3} className="bg-card px-3 py-2.5" />
                    ) : (
                      <Input {...common} type={f.type === "URL" ? "url" : "text"} className={FIELD} />
                    )}
                    {f.description && (
                      <p id={`${id}-hint`} className={HINT}>
                        {f.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </Section>
          )}
        </form>

        {props.mode === "edit" && props.team && (
          <section aria-labelledby="team-title" className="flex flex-col gap-4 border-t pt-8">
            <div className="flex items-baseline justify-between">
              <h2 id="team-title" className="text-lg font-semibold">
                Team
              </h2>
              {props.team.maxTeamSize && (
                <span className="text-[13px] text-subtle-foreground">
                  {props.team.members.length} of {props.team.maxTeamSize}
                </span>
              )}
            </div>
            <TeamManager {...props.team} />
          </section>
        )}
        {props.mode === "create" && (
          <p className="rounded-[10px] border border-dashed px-4 py-3 text-sm text-muted-foreground">
            You can invite teammates once the draft is saved.
          </p>
        )}
      </div>

      <aside
        aria-labelledby="ready-title"
        className="sticky top-6 mt-10 flex flex-col gap-4 rounded-xl border bg-card p-5 lg:col-span-4 lg:mt-23"
      >
        <div className="flex flex-col gap-1">
          <h2 id="ready-title" className="text-[15px] font-semibold">
            {!isMember ? "Moderator edit" : submitted ? "Submitted" : "Ready to submit?"}
          </h2>
          {props.jam.endDate && (
            <span className="text-[13px] text-muted-foreground">
              Closes <span className="font-mono text-foreground">{STAMP.format(props.jam.endDate)} UTC</span>
            </span>
          )}
        </div>
        {isMember && !submitted && <Checklist checks={checks} />}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {isMember && !submitted && (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={props.mode === "create" || !ready || !props.canFinalize || busy !== null}
            className="h-11 font-semibold md:h-10"
          >
            {busy === "submit" ? "Submitting…" : "Submit to jam"}
          </Button>
        )}
        <Button
          type="submit"
          form={FORM_ID}
          variant={isMember && !submitted ? "outline" : "default"}
          disabled={busy !== null}
          className="h-11 md:h-9"
        >
          {busy === "save" ? "Saving…" : props.mode === "create" ? "Save draft" : submitted || !isMember ? "Save changes" : "Save draft"}
        </Button>
        {isMember && submitted && props.mode === "edit" && props.canFinalize && (
          <Button type="button" variant="outline" onClick={onWithdraw} disabled={busy !== null} className="h-11 md:h-9">
            {busy === "withdraw" ? "Withdrawing…" : "Withdraw to draft"}
          </Button>
        )}
        <p className="text-xs leading-normal text-subtle-foreground">
          {props.mode === "create"
            ? "Save the draft to get your itch.io verification code."
            : "You and your team can keep editing until submissions close. Changing the itch.io URL returns the entry to draft."}
        </p>
        {props.mode === "edit" && props.canDelete && (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            disabled={busy !== null}
            className="h-11 text-[13px] text-destructive md:h-8"
          >
            Delete submission
          </Button>
        )}
      </aside>
    </div>
  );
}

function VerificationCard({
  submissionId,
  savedUrl,
  currentUrl,
  code,
  verified,
}: {
  submissionId: string | null;
  savedUrl: string | null;
  currentUrl: string;
  code: string | null;
  verified: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const unsaved = currentUrl.trim() !== (savedUrl ?? "");
  const pageUrl = safeHttpUrl(savedUrl);

  if (!submissionId || !savedUrl || unsaved || (!code && !verified)) {
    return (
      <p className="rounded-xl border border-dashed px-4.5 py-3.5 text-sm text-muted-foreground">
        {currentUrl.trim() ? "Save to get a verification code for this link." : "Add your itch.io project link to start verification."}
      </p>
    );
  }

  const check = () => {
    setError("");
    startTransition(async () => {
      const result = await verifySubmissionAction(submissionId);
      if (result.error) setError(result.error);
      else toast.success("Ownership verified");
      router.refresh();
    });
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border", verified && "border-live/40")}>
      <div className={cn("flex flex-wrap items-center gap-2.5 border-b px-4.5 py-3.5", verified ? "bg-live/8" : "bg-rating/8")}>
        <span aria-hidden className={cn("size-2 rounded-full", verified ? "bg-live" : "bg-rating")} />
        <span className="flex-1 text-sm font-semibold">
          {verified ? `Verified: ${displayItchUrl(savedUrl)}` : "Not verified yet"}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {verified ? "You can remove the code from your page." : "Required before you can submit"}
        </span>
      </div>
      {!verified && code && (
        <>
          <ol className="flex list-decimal flex-col gap-3 py-4.5 pr-4.5 pl-9.5 text-sm leading-relaxed text-muted-foreground">
            <li>
              Copy this code:
              <div className="mt-2 flex items-center gap-2">
                <code className="flex h-10 flex-1 items-center rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground">
                  {code}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-3.5 md:h-10"
                  onClick={() =>
                    navigator.clipboard.writeText(code).then(
                      () => toast.success("Code copied"),
                      () => toast.error("Could not copy; select the code instead")
                    )
                  }
                >
                  Copy
                </Button>
              </div>
            </li>
            <li>Paste it anywhere in your itch.io project description and save the page. You can remove it once verified.</li>
            <li>Come back and check.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2 px-4.5 pb-4.5">
            <Button type="button" onClick={check} disabled={isPending} className="h-11 px-4 font-semibold md:h-9.5">
              {isPending ? "Checking…" : "Check my page"}
            </Button>
            {pageUrl && (
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-1 px-3.5 text-sm text-muted-foreground hover:text-foreground md:h-9.5"
              >
                Open itch.io page
                <ArrowUpRight aria-hidden className="size-3.5" />
              </a>
            )}
          </div>
          {error && (
            <p role="alert" className="px-4.5 pb-4.5 text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
