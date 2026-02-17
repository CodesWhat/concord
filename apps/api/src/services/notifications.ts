import webpush from "web-push";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { pushSubscriptions } from "../models/schema.js";
import { config } from "../config.js";
import { getConnectionsByUserId } from "../gateway/connections.js";
import type { ServiceResult } from "@concord/shared";

// Configure VAPID (only if keys are set)
if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey,
  );
}

export async function subscribe(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<ServiceResult<{ subscribed: true }>> {
  // Upsert — on conflict update keys
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

  return { data: { subscribed: true }, error: null };
}

export async function unsubscribe(
  userId: string,
  endpoint: string,
): Promise<ServiceResult<{ unsubscribed: true }>> {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );

  return { data: { unsubscribed: true }, error: null };
}

export async function sendNotification(
  userId: string,
  payload: { title: string; body: string; icon?: string; url?: string },
): Promise<void> {
  if (!config.vapid.publicKey || !config.vapid.privateKey) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  const payloadStr = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadStr,
      );
    } catch (err: unknown) {
      // If subscription is expired (410 Gone), remove it
      if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
}

export async function notifyMentionedUsers(
  message: { authorId: string; content: string; channelId: string },
  mentionedUserIds: string[],
): Promise<void> {
  for (const userId of mentionedUserIds) {
    // Skip if user has an active WebSocket connection (they'll see it in real-time)
    const connections = getConnectionsByUserId(userId);
    if (connections.size > 0) continue;

    await sendNotification(userId, {
      title: "New mention in Concord",
      body: message.content.length > 100 ? message.content.slice(0, 100) + "..." : message.content,
      icon: "/web-app-manifest-192x192.png",
      url: `/app?channel=${message.channelId}`,
    });
  }
}
