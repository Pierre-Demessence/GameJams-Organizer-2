"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashSync, compare } from "bcryptjs";
import {
  DELETED_USERNAME_PREFIX,
  deleteAccountSchema,
  linkPasswordSchema,
  passwordSchema,
} from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { planAccountDeletion, type AccountBlocker } from "@/domain/account";
import { loadAccountDeletion } from "@/lib/account-queries";
import { deletedJamSlug } from "@/lib/admin";

export async function linkPasswordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (!(await checkRateLimit(`settings:password:${session.user.id}`)).allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = linkPasswordSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // A tombstone has no password, so a stale session must not be able to give it credentials.
  const user = await db.user.findUnique({ where: { id: session.user.id, deletedAt: null } });
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
  if (!(await checkRateLimit(`settings:password:${session.user.id}`)).allowed) {
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
  if (!(await checkRateLimit(`settings:unlink:${session.user.id}`)).allowed) {
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

export type DeleteAccountResult =
  | { success: true }
  | { error: string; blockers?: AccountBlocker[] };

// Spec §3 "Deleting your account". Anonymizes the user row in place (a tombstone) instead of
// removing it, because kept ratings, memberships and Jam.createdById still point at it.
export async function deleteAccountAction(confirmUsername: string): Promise<DeleteAccountResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  const userId = session.user.id;
  if (!(await checkRateLimit(`settings:delete-account:${userId}`)).allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const parsed = deleteAccountSchema.safeParse({ confirmUsername });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  return db.$transaction(async (tx): Promise<DeleteAccountResult> => {
    // Lock order matches acceptInviteAction (participant rows, then submissions) so a
    // concurrent accept cannot slip a member into a team this deletion is about to judge.
    // The jam rows serialize two co-admins deleting at once, so neither sees the other as
    // the admin who stays; NO KEY UPDATE still blocks the other deletion but not the
    // foreign-key checks of concurrent inserts (participants, submissions) that reference the jam.
    // Ordered by id so concurrent deletions queue instead of deadlocking.
    await tx.$queryRaw`
      SELECT "id" FROM "JamParticipant" WHERE "userId" = ${userId} ORDER BY "id" FOR UPDATE
    `;
    await tx.$queryRaw`
      SELECT s."id" FROM "Submission" s
      JOIN "SubmissionMember" m ON m."submissionId" = s."id"
      WHERE m."userId" = ${userId} AND m."isLeader"
      ORDER BY s."id" FOR UPDATE OF s
    `;
    await tx.$queryRaw`
      SELECT j."id" FROM "Jam" j
      JOIN "JamRole" r ON r."jamId" = j."id"
      WHERE r."userId" = ${userId} AND r."role" = 'ADMIN'
      ORDER BY j."id" FOR NO KEY UPDATE OF j
    `;

    const data = await loadAccountDeletion(tx, userId);
    if (!data) return { error: "User not found." };
    if (parsed.data.confirmUsername.toLowerCase() !== data.username) {
      return { error: "That is not your username." };
    }

    const plan = planAccountDeletion(data.input);
    if (!plan.allowed) {
      return { error: plan.blockers[0].reason, blockers: plan.blockers };
    }
    const { ops } = plan;
    const now = new Date();

    await tx.submissionMember.deleteMany({
      where: { userId, submissionId: { in: ops.removeMembershipSubmissionIds } },
    });
    await tx.submission.updateMany({
      where: { id: { in: ops.softDeleteSubmissionIds } },
      data: { deletedAt: now },
    });
    for (const jamId of ops.softDeleteJamIds) {
      const role = data.input.jamRoles.find((r) => r.jamId === jamId)!;
      await tx.jam.update({
        where: { id: jamId },
        data: { deletedAt: now, slug: deletedJamSlug(role.slug, jamId) },
      });
    }
    await tx.jamParticipant.deleteMany({
      where: { userId, jamId: { in: ops.removeParticipationJamIds } },
    });
    await tx.jamRole.deleteMany({ where: { userId } });
    await tx.submissionInvite.deleteMany({
      where: { OR: [{ inviteeId: userId }, { invitedById: userId }] },
    });
    await tx.account.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        username: `${DELETED_USERNAME_PREFIX}${userId}`,
        displayName: "Deleted user",
        email: null,
        emailVerified: null,
        passwordHash: null,
        bio: null,
        avatarUrl: null,
        totpSecret: null,
        totpEnabledAt: null,
        totpLastStep: null,
        deletedAt: now,
      },
    });
    return { success: true };
  });
}
