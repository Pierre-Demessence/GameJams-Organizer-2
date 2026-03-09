"use server";

import { headers } from "next/headers";
import { hashSync } from "bcryptjs";
import { db } from "@/lib/db";
import { signUpSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";

export async function signUpAction(formData: FormData) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = checkRateLimit(`signup:${ip}`);

  if (!allowed) {
    return { error: "Too many sign-up attempts. Please try again later." };
  }

  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    username: formData.get("username") as string,
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password, username } = parsed.data;
  const passwordHash = hashSync(password, 12);

  try {
    await db.user.create({
      data: {
        email,
        username,
        passwordHash,
      },
    });
  } catch (e: unknown) {
    // Handle unique constraint violations (P2002)
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      const meta = "meta" in e ? (e.meta as { target?: string[] }) : undefined;
      const field = meta?.target?.[0];
      if (field === "email") return { error: "An account with this email already exists." };
      if (field === "username") return { error: "This username is already taken." };
      return { error: "Account already exists." };
    }
    throw e;
  }

  return { success: true };
}
