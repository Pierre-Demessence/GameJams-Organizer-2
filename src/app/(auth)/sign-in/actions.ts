"use server";

import { headers } from "next/headers";
import { signIn } from "@/lib/auth";
import { signInSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";

export async function signInAction(formData: FormData) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = checkRateLimit(`signin:${ip}`);

  if (!allowed) {
    return { error: "Too many sign-in attempts. Please try again later." };
  }

  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return { success: true };
  } catch {
    return { error: "Invalid email or password." };
  }
}
