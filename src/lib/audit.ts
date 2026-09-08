import { db } from "@/lib/db";

// Records a platform-staff action for investigation and reversal.
// `action` uses a "namespace:verb" convention, e.g. "jam:soft_delete".
export async function recordAudit(entry: {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLogEntry.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata as object | undefined,
    },
  });
}
