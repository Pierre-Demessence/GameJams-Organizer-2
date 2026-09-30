import { jamSchema, submissionSchema } from "@/lib/validations";

function optional(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function commaList(value: FormDataEntryValue | null): string[] {
  return typeof value === "string"
    ? value.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
}

export function parseJamForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const flag = (key: string) => raw[key] === "true";
  return jamSchema.safeParse({
    ...raw,
    ranked: flag("ranked"),
    revealThemeOnStart: flag("revealThemeOnStart"),
    hideResults: flag("hideResults"),
    hideSubmissionsBeforeEnd: flag("hideSubmissionsBeforeEnd"),
    allowContributorsAfterClose: flag("allowContributorsAfterClose"),
    tags: commaList(formData.get("tags")),
    maxTeamSize: raw.maxTeamSize ? Number(raw.maxTeamSize) : undefined,
    startDate: optional(formData.get("startDate")),
    endDate: optional(formData.get("endDate")),
    ratingEnd: optional(formData.get("ratingEnd")),
    coverUrl: optional(formData.get("coverUrl")),
    hashtag: optional(formData.get("hashtag")),
    theme: optional(formData.get("theme")),
    submissionDetails: optional(formData.get("submissionDetails")),
  });
}

export function parseSubmissionForm(formData: FormData) {
  return submissionSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    screenshots: commaList(formData.get("screenshots")),
    coverUrl: optional(formData.get("coverUrl")),
    itchUrl: optional(formData.get("itchUrl")),
    supportedPlatforms: formData.getAll("platforms").map(String),
    videoUrl: optional(formData.get("videoUrl")),
    description: optional(formData.get("description")),
  });
}

// Custom field inputs are named `custom_<fieldId>`; missing inputs read as "".
export function readCustomFieldValues(
  formData: FormData,
  fields: { id: string }[]
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => {
      const value = formData.get(`custom_${field.id}`);
      return [field.id, typeof value === "string" ? value.trim() : ""];
    })
  );
}
