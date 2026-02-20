import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { channels, categories, messages } from "../models/schema.js";
import type { ServiceResult } from "@concord/shared";

export async function createChannel(
  serverId: string,
  name: string,
  type: "text" | "voice" | "announcement" | "stage" = "text",
  categoryId?: string,
): Promise<ServiceResult<typeof channels.$inferSelect>> {
  // Get next position
  const existing = await db
    .select({ position: channels.position })
    .from(channels)
    .where(
      categoryId
        ? and(eq(channels.serverId, serverId), eq(channels.categoryId, categoryId))
        : eq(channels.serverId, serverId),
    )
    .orderBy(channels.position);

  const nextPosition = existing.length > 0 ? existing[existing.length - 1]!.position + 1 : 0;

  const [channel] = await db
    .insert(channels)
    .values({
      serverId,
      name,
      type,
      categoryId,
      position: nextPosition,
    })
    .returning();

  if (!channel) {
    return { data: null, error: { code: "INTERNAL", message: "Failed to create channel", statusCode: 500 } };
  }

  return { data: channel, error: null };
}

export async function getChannel(
  channelId: string,
): Promise<ServiceResult<typeof channels.$inferSelect>> {
  const result = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 } };
  }

  return { data: result[0]!, error: null };
}

export async function getServerChannels(
  serverId: string,
): Promise<ServiceResult<Array<{
  category: { id: string; name: string; position: number } | null;
  channels: Array<typeof channels.$inferSelect>;
}>>> {
  const allChannels = await db
    .select()
    .from(channels)
    .where(eq(channels.serverId, serverId))
    .orderBy(channels.position);

  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.serverId, serverId))
    .orderBy(categories.position);

  // Group channels by category
  const grouped: Array<{
    category: { id: string; name: string; position: number } | null;
    channels: Array<typeof channels.$inferSelect>;
  }> = [];

  // Uncategorized channels first
  const uncategorized = allChannels.filter((c) => !c.categoryId);
  if (uncategorized.length > 0) {
    grouped.push({ category: null, channels: uncategorized });
  }

  for (const cat of allCategories) {
    const catChannels = allChannels.filter((c) => c.categoryId === cat.id);
    grouped.push({
      category: { id: cat.id, name: cat.name, position: cat.position },
      channels: catChannels,
    });
  }

  return { data: grouped, error: null };
}

export async function updateChannel(
  channelId: string,
  updates: { name?: string; topic?: string; nsfw?: boolean; slowmodeSeconds?: number; isPublic?: boolean },
): Promise<ServiceResult<typeof channels.$inferSelect>> {
  const result = await db
    .update(channels)
    .set(updates)
    .where(eq(channels.id, channelId))
    .returning();

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 } };
  }

  return { data: result[0]!, error: null };
}

export async function deleteChannel(
  channelId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  // Delete messages first
  await db.delete(messages).where(eq(messages.channelId, channelId));
  const result = await db.delete(channels).where(eq(channels.id, channelId)).returning();

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 } };
  }

  return { data: { deleted: true }, error: null };
}

export async function setChannelPermissionOverride(
  channelId: string,
  roleId: string,
  override: { allow: number; deny: number },
): Promise<ServiceResult<typeof channels.$inferSelect>> {
  const existing = await db
    .select({ permissionOverrides: channels.permissionOverrides })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (existing.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 } };
  }

  const overrides = (existing[0]!.permissionOverrides as Record<string, { allow: number; deny: number }>) ?? {};
  overrides[roleId] = override;

  const result = await db
    .update(channels)
    .set({ permissionOverrides: overrides })
    .where(eq(channels.id, channelId))
    .returning();

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 } };
  }

  return { data: result[0]!, error: null };
}

export async function removeChannelPermissionOverride(
  channelId: string,
  roleId: string,
): Promise<ServiceResult<typeof channels.$inferSelect>> {
  const existing = await db
    .select({ permissionOverrides: channels.permissionOverrides })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (existing.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 } };
  }

  const overrides = (existing[0]!.permissionOverrides as Record<string, { allow: number; deny: number }>) ?? {};
  delete overrides[roleId];

  const result = await db
    .update(channels)
    .set({ permissionOverrides: overrides })
    .where(eq(channels.id, channelId))
    .returning();

  if (result.length === 0) {
    return { data: null, error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 } };
  }

  return { data: result[0]!, error: null };
}
