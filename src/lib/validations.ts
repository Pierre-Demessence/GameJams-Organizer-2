import { z } from "zod";

export const slugPattern = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

export const platformValues = ["WINDOWS", "MAC", "LINUX", "WEB"] as const;

// itch.io project URL: HTTPS on itch.io or a *.itch.io subdomain.
export function isItchProjectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "itch.io" || host.endsWith(".itch.io");
  } catch {
    return false;
  }
}

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-z0-9_-]+$/, "Username must be lowercase alphanumeric, hyphens, or underscores"),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const profileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_-]+$/),
  displayName: z.string().max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export const jamSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(60)
    .regex(slugPattern, "Slug must be lowercase alphanumeric and hyphens only"),
  shortDesc: z.string().min(1, "Short description is required").max(280),
  fullDesc: z.string().min(1, "Description is required").max(50000),
  coverUrl: z.string().url().optional().or(z.literal("")),
  hashtag: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  ranked: z.boolean().default(false),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  ratingEnd: z.string().datetime().optional(),
  theme: z.string().max(200).optional(),
  revealThemeOnStart: z.boolean().default(true),
  hideResults: z.boolean().default(false),
  hideSubmissionsBeforeEnd: z.boolean().default(false),
  submissionDetails: z.string().max(5000).optional(),
  maxTeamSize: z.number().int().min(1).optional(),
  allowContributorsAfterClose: z.boolean().default(false),
  ratingEligibility: z
    .enum([
      "SUBMITTERS_ONLY",
      "SUBMITTERS_AND_CONTRIBUTORS",
      "JUDGES_ONLY",
      "EVERYONE",
    ])
    .default("SUBMITTERS_AND_CONTRIBUTORS"),
  visibility: z.enum(["PUBLIC", "UNLISTED"]).default("UNLISTED"),
});

export const submissionSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(50000).optional(),
  coverUrl: z.string().url().optional().or(z.literal("")),
  itchUrl: z
    .string()
    .refine(isItchProjectUrl, "Must be a valid itch.io project URL")
    .optional()
    .or(z.literal("")),
  supportedPlatforms: z.array(z.enum(platformValues)).optional(),
  screenshots: z.array(z.string().url()).max(10).optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
});

export const criterionSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  weight: z.number().min(0).max(100).default(1),
  source: z.enum(["RATED", "JURY"]).default("RATED"),
  isPrimary: z.boolean().default(false),
});

export const ratingSchema = z.object({
  submissionId: z.string().cuid(),
  ratings: z.array(
    z.object({
      criterionId: z.string().cuid(),
      score: z.number().int().min(1).max(5),
    })
  ),
});
