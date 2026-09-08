"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkJamPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { JamRoleType } from "@/generated/prisma/client";

export async function assignRoleAction(
  jamId: string,
  targetUsername: string,
  role: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  if (!(await checkJamPermission(jamId, session.user.id, "manage_roles"))) {
    return { error: "You do not have permission to manage roles" };
  }

  const validRoles: JamRoleType[] = ["ADMIN", "MODERATOR", "JUDGE", "HOST"];
  if (!validRoles.includes(role as JamRoleType)) {
    return { error: "Invalid role" };
  }

  const targetUser = await db.user.findUnique({
    where: { username: targetUsername },
    select: { id: true },
  });
  if (!targetUser) return { error: "User not found" };

  // Prevent assigning role to self
  if (targetUser.id === session.user.id) {
    return { error: "You cannot change your own role" };
  }

  try {
    await db.jamRole.upsert({
      where: {
        jamId_userId_role: {
          jamId,
          userId: targetUser.id,
          role: role as JamRoleType,
        },
      },
      create: { jamId, userId: targetUser.id, role: role as JamRoleType },
      update: {},
    });
  } catch {
    return { error: "Failed to assign role" };
  }

  const jam = await db.jam.findUnique({ where: { id: jamId }, select: { slug: true } });
  if (jam) {
    revalidatePath(`/jams/${jam.slug}/manage`);
    revalidatePath(`/jams/${jam.slug}`);
  }
  return { success: true };
}

export async function removeRoleAction(
  jamId: string,
  targetUserId: string,
  role: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  if (!(await checkJamPermission(jamId, session.user.id, "manage_roles"))) {
    return { error: "You do not have permission to manage roles" };
  }

  const validRoles: JamRoleType[] = ["ADMIN", "MODERATOR", "JUDGE", "HOST"];
  if (!validRoles.includes(role as JamRoleType)) {
    return { error: "Invalid role" };
  }

  // Prevent removing creator's admin role
  const jam = await db.jam.findUnique({
    where: { id: jamId },
    select: { createdById: true, slug: true },
  });
  if (!jam) return { error: "Jam not found" };

  if (targetUserId === jam.createdById && role === "ADMIN") {
    return { error: "Cannot remove the creator's admin role" };
  }

  // Prevent removing own role
  if (targetUserId === session.user.id) {
    return { error: "You cannot remove your own role" };
  }

  await db.jamRole.deleteMany({
    where: { jamId, userId: targetUserId, role: role as JamRoleType },
  });

  revalidatePath(`/jams/${jam.slug}/manage`);
  revalidatePath(`/jams/${jam.slug}`);
  return { success: true };
}

export async function searchUsersForRole(query: string) {
  const session = await auth();
  if (!session?.user?.id) return { users: [] };

  if (!query || query.length < 2) return { users: [] };

  const users = await db.user.findMany({
    where: {
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
    take: 10,
  });

  return { users };
}
