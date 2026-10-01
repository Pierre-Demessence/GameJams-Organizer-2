"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkStaffPermission } from "@/lib/staff-permissions";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { restoredSlug } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function grantSiteAdminAction(identifier: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  if (!(await checkStaffPermission(session.user.id, "manage_staff"))) {
    return { error: "You do not have permission" };
  }

  const query = identifier.trim();
  if (!query) return { error: "Enter a username or email" };

  const user = await db.user.findFirst({
    where: { OR: [{ username: query }, { email: query }] },
    select: { id: true, username: true },
  });
  if (!user) return { error: "No user found with that username or email" };

  await db.staffRole.upsert({
    where: { userId_role: { userId: user.id, role: "SITE_ADMIN" } },
    update: {},
    create: { userId: user.id, role: "SITE_ADMIN" },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "staff:grant",
    targetType: "user",
    targetId: user.id,
    metadata: { role: "SITE_ADMIN", username: user.username },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function revokeSiteAdminAction(userId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  if (!(await checkStaffPermission(session.user.id, "manage_staff"))) {
    return { error: "You do not have permission" };
  }

  const adminCount = await db.staffRole.count({ where: { role: "SITE_ADMIN" } });
  if (adminCount <= 1) {
    return { error: "Cannot remove the last Site Admin" };
  }

  await db.staffRole.deleteMany({
    where: { userId, role: "SITE_ADMIN" },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "staff:revoke",
    targetType: "user",
    targetId: userId,
    metadata: { role: "SITE_ADMIN" },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function restoreJamAction(jamId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  if (!(await checkStaffPermission(session.user.id, "delete_any_jam"))) {
    return { error: "You do not have permission" };
  }
  if (!checkRateLimit(`restore:${session.user.id}`, 60).allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  // Naming deletedAt in the where bypasses the soft-delete read filter.
  const jam = await db.jam.findFirst({ where: { id: jamId, deletedAt: { not: null } } });
  if (!jam) return { error: "Deleted jam not found" };

  const slug = restoredSlug(jam.slug, jam.id);
  const taken = await db.jam.findFirst({ where: { slug, id: { not: jam.id } }, select: { id: true } });
  if (taken) return { error: `Another jam now uses /jams/${slug}. Rename it before restoring.` };

  try {
    await db.jam.update({ where: { id: jam.id }, data: { deletedAt: null, slug } });
  } catch (err: unknown) {
    // A jam created between the check and the update can still take the slug.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return { error: `Another jam now uses /jams/${slug}. Rename it before restoring.` };
    }
    throw err;
  }
  await recordAudit({
    actorId: session.user.id,
    action: "jam:restore",
    targetType: "jam",
    targetId: jam.id,
    metadata: { slug, name: jam.name },
  });

  revalidatePath("/admin");
  revalidatePath("/jams");
  return { success: true };
}

export async function restoreSubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  if (!(await checkStaffPermission(session.user.id, "moderate_any_submission"))) {
    return { error: "You do not have permission" };
  }
  if (!checkRateLimit(`restore:${session.user.id}`, 60).allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const submission = await db.submission.findFirst({
    where: { id: submissionId, deletedAt: { not: null } },
    include: { members: { select: { userId: true } }, jam: { select: { slug: true, deletedAt: true } } },
  });
  if (!submission) return { error: "Deleted submission not found" };
  if (submission.jam.deletedAt) return { error: "Restore its jam first" };

  // One live submission per user per jam: members may have joined another team since.
  const clash = await db.submissionMember.findFirst({
    where: {
      userId: { in: submission.members.map((m) => m.userId) },
      submission: { jamId: submission.jamId, deletedAt: null, id: { not: submission.id } },
    },
    select: { user: { select: { username: true } } },
  });
  if (clash) return { error: `${clash.user.username} is now on another submission in this jam` };

  await db.submission.update({ where: { id: submission.id }, data: { deletedAt: null } });
  await recordAudit({
    actorId: session.user.id,
    action: "submission:restore",
    targetType: "submission",
    targetId: submission.id,
    metadata: { jamId: submission.jamId, title: submission.title },
  });

  revalidatePath("/admin");
  revalidatePath(`/jams/${submission.jam.slug}`);
  return { success: true };
}
