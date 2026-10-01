"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import type { JamPhase } from "@/domain/jam-phase";
import { checkSlugAvailable, createJamAction, publishJamAction, updateJamAction } from "@/app/jams/actions";
import { CriteriaManager, type Criterion } from "@/app/jams/[slug]/edit/criteria-manager";
import { CustomFieldsManager, type CustomField } from "@/app/jams/[slug]/edit/custom-fields-manager";
import { publishChecklist, scheduleSummary, slugify } from "@/lib/jam-form";
import { CheckField, Checklist, FIELD, Field, HINT, Section } from "@/components/editor";
import { formatTimeLeftShort } from "@/lib/jam-status-display";
import { ratingEligibilityLabel } from "@/lib/jam-labels";
import { slugPattern } from "@/lib/validations";
import { cn } from "@/lib/utils";

const FORM_ID = "jam-form";
const MONO = "font-mono text-[13px] md:text-[13px]";
const ELIGIBILITY = ["SUBMITTERS_AND_CONTRIBUTORS", "SUBMITTERS_ONLY", "JUDGES_ONLY", "EVERYONE"] as const;
const STAMP = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export interface EditableJam {
  id: string;
  name: string;
  slug: string;
  shortDesc: string;
  fullDesc: string;
  coverUrl: string | null;
  hashtag: string | null;
  tags: string[];
  ranked: boolean;
  startDate: Date | null;
  endDate: Date | null;
  ratingEnd: Date | null;
  theme: string | null;
  revealThemeOnStart: boolean;
  hideResults: boolean;
  hideSubmissionsBeforeEnd: boolean;
  submissionDetails: string | null;
  maxTeamSize: number | null;
  allowContributorsAfterClose: boolean;
  ratingEligibility: string;
  visibility: string;
  publishedAt: Date | null;
}

type JamFormProps =
  | { mode: "create" }
  | {
      mode: "edit";
      jam: EditableJam;
      phase: JamPhase;
      criteria: Criterion[];
      // Every criterion, JURY included, so the checklist matches canPublish().
      publishCriteria: { source: "RATED" | "JURY"; weight: number; isPrimary: boolean }[];
      fields: CustomField[];
      locked: boolean;
    };

// datetime-local inputs work in the browser's time zone; the server stores UTC.
function toLocalInput(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(value: string): Date | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function JamForm(props: JamFormProps) {
  const router = useRouter();
  const jam = props.mode === "edit" ? props.jam : null;
  const published = Boolean(jam?.publishedAt);

  const [name, setName] = useState(jam?.name ?? "");
  const [slug, setSlug] = useState(jam?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(props.mode === "edit");
  const [shortDesc, setShortDesc] = useState(jam?.shortDesc ?? "");
  const [fullDesc, setFullDesc] = useState(jam?.fullDesc ?? "");
  const [preview, setPreview] = useState(false);
  const [coverUrl, setCoverUrl] = useState(jam?.coverUrl ?? "");
  const [tags, setTags] = useState<string[]>(jam?.tags ?? []);
  const [ranked, setRanked] = useState(jam?.ranked ?? true);
  const [start, setStart] = useState(toLocalInput(jam?.startDate ?? null));
  const [end, setEnd] = useState(toLocalInput(jam?.endDate ?? null));
  const [ratingEnd, setRatingEnd] = useState(toLocalInput(jam?.ratingEnd ?? null));
  const [theme, setTheme] = useState(jam?.theme ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const slugStatus = useSlugStatus(slug, jam?.slug ?? null);

  const dates = { startDate: fromLocalInput(start), endDate: fromLocalInput(end), ratingEnd: fromLocalInput(ratingEnd) };
  const schedule = scheduleSummary({ ...dates, ranked });
  const fields = props.mode === "edit" ? props.fields : [];
  const { checks, ready } = publishChecklist({
    name,
    slug,
    shortDesc,
    fullDesc,
    coverUrl,
    theme,
    ranked,
    ...dates,
    criteria: props.mode === "edit" ? props.publishCriteria : [],
    customFieldCount: fields.length,
  });

  const sections = [
    { id: "basics", label: "Basics" },
    { id: "schedule", label: "Format & schedule" },
    { id: "theme", label: "Theme" },
    ...(ranked ? [{ id: "rating", label: "Rating" }] : []),
    { id: "submissions", label: "Submissions" },
    { id: "visibility", label: "Visibility" },
  ];

  async function save(): Promise<string | null> {
    const form = document.getElementById(FORM_ID) as HTMLFormElement;
    if (!form.reportValidity()) return null;
    const fd = new FormData(form);
    fd.set("ranked", String(ranked));
    fd.set("tags", tags.join(","));
    for (const [key, value] of Object.entries(dates)) {
      if (value && (key !== "ratingEnd" || ranked)) fd.set(key, value.toISOString());
      else fd.delete(key);
    }
    const result = props.mode === "create" ? await createJamAction(fd) : await updateJamAction(props.jam.id, fd);
    if (result.error) {
      setError(result.error);
      return null;
    }
    return "slug" in result && result.slug ? result.slug : slug;
  }

  async function onSave() {
    setError("");
    setBusy("save");
    try {
      const saved = await save();
      if (!saved) return;
      toast.success(props.mode === "create" ? "Draft saved" : "Changes saved");
      if (props.mode === "create" || saved !== jam?.slug) router.replace(`/jams/${saved}/edit`);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onPublish() {
    if (props.mode !== "edit") return;
    setError("");
    setBusy("publish");
    try {
      const saved = await save();
      if (!saved) return;
      const result = await publishJamAction(props.jam.id);
      if (result.error) {
        setError(result.error);
        // The save may have renamed the jam, so the current URL could be gone.
        if (saved !== props.jam.slug) router.replace(`/jams/${saved}/edit`);
        else router.refresh();
        return;
      }
      toast.success("Jam published");
      router.push(`/jams/${saved}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-x-12 px-4 pt-6 pb-16 md:px-12 md:pt-10 lg:grid-cols-12">
      <nav
        aria-label="Form sections"
        className="sticky top-6 hidden flex-col gap-0.5 pt-21 lg:col-span-2 lg:flex"
      >
        {sections.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex h-8.5 items-center gap-2.5 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span className="w-4 font-mono text-xs text-subtle-foreground">{i + 1}</span>
            {s.label}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-10 lg:col-span-7">
        <div className="flex flex-col gap-1.5">
          {jam && (
            <nav aria-label="Breadcrumb" className="text-[13px] text-subtle-foreground">
              <Link href={`/jams/${jam.slug}`} className="hover:text-foreground">
                {jam.name}
              </Link>{" "}
              / Edit
            </nav>
          )}
          <h1 className="text-[30px] font-semibold tracking-tight">{jam ? "Edit jam" : "Host a jam"}</h1>
          <p className="text-muted-foreground">
            {published
              ? "Changes go live as soon as you save."
              : "Everything stays private in draft until you publish."}
          </p>
        </div>

        <form
          id={FORM_ID}
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
          className="flex flex-col gap-10"
        >
          <Section id="basics" title="Basics" first>
            <Field label="Name" htmlFor="name">
              <Input
                id="name"
                name="name"
                required
                maxLength={100}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                className={FIELD}
              />
            </Field>
            <Field label="URL" htmlFor="slug" hint={<SlugHint status={slugStatus} />}>
              <div className="flex h-11 overflow-hidden rounded-lg border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:h-10">
                <span className="flex items-center border-r border-input bg-muted px-3 font-mono text-[13px] text-subtle-foreground">
                  /jams/
                </span>
                <input
                  id="slug"
                  name="slug"
                  required
                  maxLength={60}
                  // Same rule as slugPattern; `pattern` compiles with the v flag, which needs `-` escaped.
                  pattern="[a-z0-9][a-z0-9\-]{1,58}[a-z0-9]"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] outline-none"
                />
              </div>
            </Field>
            <Field label="Short description" htmlFor="shortDesc" hint="Shown in listings.">
              <Input
                id="shortDesc"
                name="shortDesc"
                required
                maxLength={280}
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                className={FIELD}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="fullDesc">
                  Description <span className="font-normal text-subtle-foreground">· Markdown</span>
                </Label>
                <div role="group" aria-label="Editor mode" className="flex gap-0.5">
                  {[
                    { on: false, label: "Write" },
                    { on: true, label: "Preview" },
                  ].map((m) => (
                    <button
                      key={m.label}
                      type="button"
                      aria-pressed={preview === m.on}
                      onClick={() => setPreview(m.on)}
                      className={cn(
                        "h-8 rounded-[5px] px-2.5 text-xs md:h-6.5",
                        preview === m.on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                id="fullDesc"
                name="fullDesc"
                required
                maxLength={50000}
                rows={8}
                value={fullDesc}
                onChange={(e) => setFullDesc(e.target.value)}
                className={cn("bg-card px-3 py-2.5 font-mono text-[13px] leading-relaxed md:text-[13px]", preview && "hidden")}
              />
              {preview && (
                <div className="min-h-40 rounded-lg border border-input bg-card px-4 py-3">
                  {fullDesc.trim() ? (
                    <Markdown>{fullDesc}</Markdown>
                  ) : (
                    <p className="text-sm text-subtle-foreground">Nothing to preview yet.</p>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cover image URL" htmlFor="coverUrl">
                <Input
                  id="coverUrl"
                  name="coverUrl"
                  type="url"
                  placeholder="https://…"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className={FIELD}
                />
              </Field>
              <Field label="Hashtag" htmlFor="hashtag">
                <Input
                  id="hashtag"
                  name="hashtag"
                  maxLength={50}
                  placeholder="#MyJam"
                  defaultValue={jam?.hashtag ?? ""}
                  className={FIELD}
                />
              </Field>
            </div>
            <TagsInput tags={tags} onChange={setTags} />
          </Section>

          <Section
            id="schedule"
            title="Format & schedule"
            description="Once published, the jam's status follows these dates automatically."
          >
            <div role="group" aria-label="Format" className="grid gap-3 md:grid-cols-2">
              {[
                { value: true, label: "Ranked", body: "Entries are rated on your criteria after submissions close, then ranked." },
                { value: false, label: "Showcase", body: "No ratings or rankings: the result is the collection of games." },
              ].map((f) => (
                <button
                  key={f.label}
                  type="button"
                  aria-pressed={ranked === f.value}
                  onClick={() => setRanked(f.value)}
                  className={cn(
                    "flex flex-col gap-1 rounded-[10px] border p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    ranked === f.value ? "border-brand bg-muted" : "bg-card hover:border-input"
                  )}
                >
                  <span className="text-[15px] font-semibold">{f.label}</span>
                  <span className="text-[13px] leading-normal text-muted-foreground">{f.body}</span>
                </button>
              ))}
            </div>
            <div className={cn("grid gap-4", ranked ? "md:grid-cols-3" : "md:grid-cols-2")}>
              <Field label="Starts" htmlFor="startDate">
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={cn(FIELD, MONO, "dark:scheme-dark")}
                />
              </Field>
              <Field label="Submissions close" htmlFor="endDate">
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={cn(FIELD, MONO, "dark:scheme-dark")}
                />
              </Field>
              {ranked && (
                <Field label="Rating ends" htmlFor="ratingEnd">
                  <Input
                    id="ratingEnd"
                    type="datetime-local"
                    value={ratingEnd}
                    onChange={(e) => setRatingEnd(e.target.value)}
                    className={cn(FIELD, MONO, "dark:scheme-dark")}
                  />
                </Field>
              )}
            </div>
            <p className={HINT}>Times are in your local time zone.</p>
            {schedule && (
              <div className="flex flex-col gap-2 rounded-[10px] border bg-card px-4 py-3.5">
                <div aria-hidden className="flex h-1.5 gap-0.75">
                  <div className="rounded-[3px] bg-live" style={{ width: `${schedule.jamPct}%` }} />
                  {schedule.jamPct < 100 && <div className="flex-1 rounded-[3px] bg-rating" />}
                </div>
                <span className={HINT}>{schedule.text}</span>
              </div>
            )}
          </Section>

          <Section id="theme" title="Theme">
            <Field label="Theme" optional htmlFor="theme">
              <Input
                id="theme"
                name="theme"
                maxLength={200}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className={FIELD}
              />
            </Field>
            <CheckField
              name="revealThemeOnStart"
              defaultChecked={jam?.revealThemeOnStart ?? true}
              label="Keep it secret until the jam starts"
              help="Participants see the theme at the start date."
            />
          </Section>

          {/* Kept mounted while hidden so its settings survive switching to Showcase and back. */}
          <Section id="rating" title="Rating" hidden={!ranked}>
            <Field label="Who can rate" htmlFor="ratingEligibility" className="max-w-80">
              <select
                id="ratingEligibility"
                name="ratingEligibility"
                defaultValue={jam?.ratingEligibility ?? "SUBMITTERS_AND_CONTRIBUTORS"}
                className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-10"
              >
                {ELIGIBILITY.map((e) => (
                  <option key={e} value={e}>
                    {ratingEligibilityLabel(e)}
                  </option>
                ))}
              </select>
            </Field>
            {props.mode === "edit" ? (
              <CriteriaManager jamId={props.jam.id} criteria={props.criteria} locked={props.locked} />
            ) : (
              <SaveFirst>Add rating criteria once the draft is saved.</SaveFirst>
            )}
            <CheckField
              name="hideResults"
              defaultChecked={jam?.hideResults ?? false}
              label="Hide results until I reveal them"
              help="Organizers can preview; the public sees results only after you reveal."
            />
          </Section>

          <Section id="submissions" title="Submissions">
            <Field label="Max team size" optional htmlFor="maxTeamSize" className="max-w-50">
              <Input
                id="maxTeamSize"
                name="maxTeamSize"
                type="number"
                min={1}
                defaultValue={jam?.maxTeamSize ?? ""}
                placeholder="No limit"
                className={cn(FIELD, MONO)}
              />
            </Field>
            <CheckField
              name="hideSubmissionsBeforeEnd"
              defaultChecked={jam?.hideSubmissionsBeforeEnd ?? false}
              label="Hide submissions until the jam ends"
              help="Entries stay reachable by direct link."
            />
            <CheckField
              name="allowContributorsAfterClose"
              defaultChecked={jam?.allowContributorsAfterClose ?? false}
              label="Allow adding teammates during rating"
              help="Teammates can be added (never removed) after submissions close."
            />
            {props.mode === "edit" ? (
              <CustomFieldsManager jamId={props.jam.id} fields={props.fields} locked={props.locked} />
            ) : (
              <SaveFirst>Add custom questions once the draft is saved.</SaveFirst>
            )}
            <Field label="Instructions for submitters" optional htmlFor="submissionDetails">
              <Textarea
                id="submissionDetails"
                name="submissionDetails"
                maxLength={5000}
                rows={3}
                defaultValue={jam?.submissionDetails ?? ""}
                className="bg-card px-3 py-2.5"
              />
            </Field>
          </Section>

          <Section id="visibility" title="Visibility">
            <fieldset className="flex flex-col gap-2.5">
              <legend className="sr-only">Visibility</legend>
              {[
                { value: "PUBLIC", label: "Public", help: "Listed on the site once published." },
                { value: "UNLISTED", label: "Unlisted", help: "Only people with the link can find it." },
              ].map((v) => (
                <label key={v.value} className="flex items-start gap-3 text-sm">
                  <input
                    type="radio"
                    name="visibility"
                    value={v.value}
                    defaultChecked={(jam?.visibility ?? "PUBLIC") === v.value}
                    className="mt-0.5 size-4 accent-brand"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{v.label}</span>
                    <span className="text-[13px] text-muted-foreground">{v.help}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </Section>
        </form>
      </div>

      <aside
        aria-labelledby="ready-title"
        className="sticky top-6 mt-10 flex flex-col gap-4 rounded-xl border bg-card p-5 lg:col-span-3 lg:mt-21"
      >
        <div className="flex flex-col gap-1">
          <h2 id="ready-title" className="text-[15px] font-semibold">
            {published ? "Published" : "Ready to publish?"}
          </h2>
          {dates.startDate && (
            <span className="text-[13px] text-muted-foreground">
              Starts <span className="font-mono text-foreground">{STAMP.format(dates.startDate)} UTC</span>
              <StartsIn at={dates.startDate} />
            </span>
          )}
        </div>
        {!published && <Checklist checks={checks} />}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {published ? (
          <>
            <Button type="submit" form={FORM_ID} disabled={busy !== null} className="h-11 font-semibold md:h-10">
              {busy === "save" ? "Saving…" : "Save changes"}
            </Button>
            <Link href={`/jams/${jam!.slug}`} className="text-center text-sm text-muted-foreground hover:text-foreground">
              View jam
            </Link>
          </>
        ) : (
          <>
            <Button
              type="button"
              onClick={onPublish}
              disabled={props.mode === "create" || !ready || busy !== null || slugStatus === "taken"}
              className="h-11 font-semibold md:h-10"
            >
              {busy === "publish" ? "Publishing…" : "Publish jam"}
            </Button>
            <Button type="submit" form={FORM_ID} variant="outline" disabled={busy !== null} className="h-11 md:h-9">
              {busy === "save" ? "Saving…" : "Save draft"}
            </Button>
            <p className="text-xs leading-normal text-subtle-foreground">
              {props.mode === "create"
                ? "Save the draft first, then add criteria and questions and publish."
                : "Drafts are private. Once published, the jam appears in listings (if public) and follows its dates."}
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function useSlugStatus(slug: string, current: string | null): SlugStatus {
  const [status, setStatus] = useState<{ slug: string; value: SlugStatus }>({ slug: "", value: "idle" });
  const latest = useRef(slug);

  useEffect(() => {
    latest.current = slug;
    if (!slug || slug === current || !slugPattern.test(slug)) return;
    const timer = setTimeout(async () => {
      const result = await checkSlugAvailable(slug).catch(() => null);
      if (result && latest.current === slug) {
        const value = result.available === null ? "idle" : result.available ? "available" : "taken";
        setStatus({ slug, value });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [slug, current]);

  if (!slug) return "idle";
  if (!slugPattern.test(slug)) return "invalid";
  if (slug === current) return "available";
  return status.slug === slug ? status.value : "checking";
}

function SlugHint({ status }: { status: SlugStatus }) {
  if (status === "available") return <span className="text-live">✓ Available</span>;
  if (status === "taken") return <span className="text-destructive">Already taken</span>;
  if (status === "invalid") return <>Lowercase letters, numbers and hyphens; 3 to 60 characters.</>;
  if (status === "checking") return <>Checking…</>;
  return null;
}

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const tag = draft.trim().replace(/,/g, "");
    setDraft("");
    if (tag && tags.length < 10 && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      onChange([...tags, tag.slice(0, 30)]);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="tag-input">Tags</Label>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:min-h-10">
        {tags.map((t) => (
          <span key={t} className="flex h-6.5 items-center gap-1 rounded-full bg-muted pr-1 pl-2.5 text-[13px]">
            {t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="flex size-5 items-center justify-center rounded-full text-subtle-foreground hover:text-foreground"
            >
              <X aria-hidden className="size-3" />
            </button>
          </span>
        ))}
        <input
          id="tag-input"
          value={draft}
          disabled={tags.length >= 10}
          placeholder={tags.length >= 10 ? "10 tags max" : "Add a tag"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
            if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
          }}
          className="h-8 min-w-30 flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
      <p className={HINT}>Press Enter to add. Up to 10.</p>
    </div>
  );
}

const noSubscribe = () => () => {};

function StartsIn({ at }: { at: Date }) {
  // Read once on the client: the server render shows no relative time, so hydration matches.
  const now = useSyncExternalStore(noSubscribe, readClock, () => null);
  if (!now || at.getTime() <= now) return null;
  return <> · in {formatTimeLeftShort(at.getTime() - now)}</>;
}

// A per-minute snapshot keeps useSyncExternalStore's snapshot stable between renders.
function readClock(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

function SaveFirst({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[10px] border border-dashed px-4 py-3 text-sm text-muted-foreground">{children}</p>;
}
