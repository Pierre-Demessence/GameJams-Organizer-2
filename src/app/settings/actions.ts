"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashSync, compare } from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const linkPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  email: z.string().email(),
});

export async function linkPasswordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

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

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!currentPassword || !newPassword) {
    return { error: "Both fields are required." };
  }

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

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
