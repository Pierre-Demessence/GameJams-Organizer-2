"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashSync, compare } from "bcryptjs";
import { linkPasswordSchema, passwordSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";

export async function linkPasswordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (!checkRateLimit(`settings:password:${session.user.id}`).allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = linkPasswordSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "User not found." };

  if (user.passwordHash) {
    return { error: "Password login is already configured." };
  }

  const existingEmail = await db.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existingEmail && existingEmail.id !== user.id) {
    return { error: "This email is already used by another account." };
  }

  const passwordHash = hashSync(parsed.data.password, 12);
  await db.user.update({
    where: { id: user.id },
    data: { email: parsed.data.email, passwordHash },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function changePasswordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (!checkRateLimit(`settings:password:${session.user.id}`).allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!currentPassword || !newPassword) {
    return { error: "Both fields are required." };
  }

  const rule = passwordSchema.safeParse(newPassword);
  if (!rule.success) return { error: rule.error.issues[0].message };

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) return { error: "No password set." };

  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const passwordHash = hashSync(newPassword, 12);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function unlinkProviderAction(provider: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (!checkRateLimit(`settings:unlink:${session.user.id}`).allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { accounts: true },
  });
  if (!user) return { error: "User not found." };

  // Must keep at least one auth method
  const hasPassword = !!user.passwordHash;
  const otherAccounts = user.accounts.filter((a) => a.provider !== provider);

  if (!hasPassword && otherAccounts.length === 0) {
    return { error: "Cannot unlink your only sign-in method." };
  }

  await db.account.deleteMany({
    where: { userId: user.id, provider },
  });

  revalidatePath("/settings");
  return { success: true };
}
