import type { Check } from "@/lib/jam-form";

export interface SubmitChecklistInput {
  title: string;
  description: string;
  platforms: number;
  coverUrl: string;
  // The saved link: verification is tied to it, so an unsaved edit does not count.
  hasItchUrl: boolean;
  verified: boolean;
  missingRequiredFields: string[];
  hasRequiredFields: boolean;
}

// Mirrors canFinalizeSubmission() for the required items; description, platforms and cover
// are recommendations.
export function submitChecklist(input: SubmitChecklistInput): { checks: Check[]; ready: boolean } {
  const required: Check[] = [
    { key: "title", label: "Title", section: "details", state: input.title.trim() ? "done" : "todo" },
    {
      key: "itch",
      label: "itch.io page verified",
      section: "itch",
      state: input.hasItchUrl && input.verified ? "done" : "todo",
      hint: !input.hasItchUrl ? "Add and save your itch.io link" : input.verified ? undefined : "Check your page",
    },
  ];
  if (input.hasRequiredFields) {
    required.push({
      key: "questions",
      label: "Required jam questions",
      section: "questions",
      state: input.missingRequiredFields.length === 0 ? "done" : "todo",
      hint: input.missingRequiredFields.length ? `Missing: ${input.missingRequiredFields.join(", ")}` : undefined,
    });
  }
  const recommended = (key: string, label: string, section: string, done: boolean): Check => ({
    key,
    label,
    section,
    state: done ? "done" : "optional",
  });
  const checks = [
    ...required,
    recommended("description", "Description", "details", input.description.trim() !== ""),
    recommended("platforms", "At least one platform", "details", input.platforms > 0),
    recommended("cover", "Cover image", "details", input.coverUrl.trim() !== ""),
  ];
  return { checks, ready: required.every((c) => c.state === "done") };
}

// The verification code must sit on the itch.io page; a short, readable host+path helps the
// team spot the right page.
export function displayItchUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
