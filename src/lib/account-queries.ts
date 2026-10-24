import { db } from "@/lib/db";
import { jamPhase } from "@/domain/jam-phase";
import type { AccountDeletionInput } from "@/domain/account";

// Either the shared client (settings preview) or a transaction client (the action, after it
// has locked the rows this reads).
type Client = Parameters<Parameters<typeof db.$transaction>[0]>[0] | typeof db;

const JAM_PHASE_FIELDS = {
  publishedAt: true,
  startDate: true,
  endDate: true,
  ratingEnd: true,
  ranked: true,
} as const;

export interface AccountDeletionData {
  username: string;
  input: AccountDeletionInput;
  // Kept as they are: shown on the confirmation screen, not part of the rules.
  ratingCount: number;
  inviteCount: number;
}

// Everything the account-deletion rules need. Relation filters bypass the soft-delete
// extension, so trashed jams are excluded explicitly: they are already out of play.
// Returns null for a missing or already deleted user.
export async function loadAccountDeletion(
  client: Client,
  userId: string
): Promise<AccountDeletionData | null> {
  const user = await client.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { username: true },
  });
  if (!user) return null;

  const [staffRoles, memberships, jamRoles, participations, ratingCount, inviteCount] =
    await Promise.all([
      client.staffRole.count({ where: { userId } }),
      client.submissionMember.findMany({
        where: { userId, submission: { jam: { deletedAt: null } } },
        select: {
          isLeader: true,
          submission: {
            select: {
              id: true,
              title: true,
              deletedAt: true,
              jam: { select: JAM_PHASE_FIELDS },
              _count: { select: { members: true } },
            },
          },
        },
      }),
      client.jamRole.findMany({
        where: { userId, jam: { deletedAt: null } },
        select: {
          role: true,
          jam: {
            select: {
              id: true,
              slug: true,
              name: true,
              ...JAM_PHASE_FIELDS,
              _count: { select: { roles: { where: { role: "ADMIN" } } } },
            },
          },
        },
      }),
      client.jamParticipant.findMany({
        where: { userId, jam: { deletedAt: null } },
        select: { jam: { select: { id: true, ...JAM_PHASE_FIELDS } } },
      }),
      client.rating.count({ where: { userId } }),
      client.submissionInvite.count({
        where: { OR: [{ inviteeId: userId }, { invitedById: userId }] },
      }),
    ]);

  const now = new Date();
  return {
    username: user.username,
    ratingCount,
    inviteCount,
    input: {
      userId,
      isStaff: staffRoles > 0,
      memberships: memberships.map((m) => ({
        submissionId: m.submission.id,
        title: m.submission.title,
        phase: jamPhase(m.submission.jam, now),
        isLeader: m.isLeader,
        memberCount: m.submission._count.members,
        submissionDeletedAt: m.submission.deletedAt,
      })),
      jamRoles: jamRoles.map((r) => ({
        jamId: r.jam.id,
        slug: r.jam.slug,
        name: r.jam.name,
        role: r.role,
        phase: jamPhase(r.jam, now),
        publishedAt: r.jam.publishedAt,
        adminCount: r.jam._count.roles,
      })),
      participations: participations.map((p) => ({
        jamId: p.jam.id,
        phase: jamPhase(p.jam, now),
      })),
    },
  };
}
