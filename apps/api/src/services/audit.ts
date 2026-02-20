import { eq, and, lt, desc } from "drizzle-orm";
import { db } from "../db.js";
import { auditLog } from "../models/schema.js";
import { generateSnowflake } from "../utils/snowflake.js";

export const AuditAction = {
  CHANNEL_CREATE: "CHANNEL_CREATE",
  CHANNEL_UPDATE: "CHANNEL_UPDATE",
  CHANNEL_DELETE: "CHANNEL_DELETE",
  ROLE_CREATE: "ROLE_CREATE",
  ROLE_UPDATE: "ROLE_UPDATE",
  ROLE_DELETE: "ROLE_DELETE",
  MEMBER_BAN: "MEMBER_BAN",
  MEMBER_UNBAN: "MEMBER_UNBAN",
  MEMBER_KICK: "MEMBER_KICK",
  MESSAGE_DELETE: "MESSAGE_DELETE",
  SERVER_UPDATE: "SERVER_UPDATE",
  AUTOMOD_RULE_CREATE: "AUTOMOD_RULE_CREATE",
  AUTOMOD_RULE_UPDATE: "AUTOMOD_RULE_UPDATE",
  AUTOMOD_RULE_DELETE: "AUTOMOD_RULE_DELETE",
} as const;

// Fire-and-forget insert -- never awaited in request path
export function logAction(
  serverId: string,
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  changes?: Record<string, unknown>,
  reason?: string,
): void {
  const id = BigInt(generateSnowflake());
  db.insert(auditLog)
    .values({ id, serverId, actorId, action, targetType, targetId, changes: changes ?? {}, reason })
    .catch((err) => console.error("[Audit] logAction error:", err));
}

// Query audit log with filters
export async function getAuditLog(
  serverId: string,
  filters: {
    actorId?: string;
    action?: string;
    targetType?: string;
    before?: string;
    limit?: number;
  },
) {
  const { actorId, action, targetType, before, limit = 50 } = filters;
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const conditions = [eq(auditLog.serverId, serverId)];
  if (actorId) conditions.push(eq(auditLog.actorId, actorId));
  if (action) conditions.push(eq(auditLog.action, action));
  if (targetType) conditions.push(eq(auditLog.targetType, targetType));
  if (before) conditions.push(lt(auditLog.id, BigInt(before)));

  const rows = await db
    .select()
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.id))
    .limit(safeLimit);

  return rows.map((r) => ({
    ...r,
    id: r.id.toString(),
  }));
}
