import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface ConcordDB extends DBSchema {
  messages: {
    key: string; // message ID
    value: {
      id: string;
      channelId: string;
      authorId: string;
      content: string;
      attachments: unknown[];
      embeds: unknown[];
      replyToId: string | null;
      threadId: string | null;
      editedAt: string | null;
      deleted: boolean;
      createdAt: string;
      author: {
        username: string;
        displayName: string;
        avatarUrl: string | null;
      };
    };
    indexes: { "by-channel": string };
  };
  pendingMessages: {
    key: string; // temp ID
    value: {
      id: string;
      channelId: string;
      content: string;
      createdAt: string;
      status: "pending" | "sending" | "failed";
    };
  };
  channels: {
    key: string;
    value: {
      id: string;
      serverId: string;
      name: string;
      type: string;
    };
  };
  readStates: {
    key: string; // channelId
    value: {
      channelId: string;
      lastReadMessageId: string | null;
      mentionCount: number;
    };
  };
}

const DB_NAME = "concord-offline";
const DB_VERSION = 1;
const MAX_CACHED_MESSAGES = 5000;

let dbPromise: Promise<IDBPDatabase<ConcordDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<ConcordDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ConcordDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const messageStore = db.createObjectStore("messages", {
          keyPath: "id",
        });
        messageStore.createIndex("by-channel", "channelId");
        db.createObjectStore("pendingMessages", { keyPath: "id" });
        db.createObjectStore("channels", { keyPath: "id" });
        db.createObjectStore("readStates", { keyPath: "channelId" });
      },
    });
  }
  return dbPromise;
}

// Cache messages for a channel (replace existing)
export async function cacheMessages(
  channelId: string,
  messages: ConcordDB["messages"]["value"][],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("messages", "readwrite");
  for (const msg of messages) {
    await tx.store.put(msg);
  }
  await tx.done;
  await evictOldMessages();
}

// Get cached messages for a channel
export async function getCachedMessages(
  channelId: string,
): Promise<ConcordDB["messages"]["value"][]> {
  const db = await getDb();
  return db.getAllFromIndex("messages", "by-channel", channelId);
}

// Queue a message for sending when online
export async function queuePendingMessage(
  msg: ConcordDB["pendingMessages"]["value"],
): Promise<void> {
  const db = await getDb();
  await db.put("pendingMessages", msg);
}

// Get all pending messages
export async function getPendingMessages(): Promise<
  ConcordDB["pendingMessages"]["value"][]
> {
  const db = await getDb();
  return db.getAll("pendingMessages");
}

// Remove a pending message after successful send
export async function removePendingMessage(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("pendingMessages", id);
}

// LRU eviction: keep only MAX_CACHED_MESSAGES
async function evictOldMessages(): Promise<void> {
  const db = await getDb();
  const allMessages = await db.getAll("messages");
  if (allMessages.length <= MAX_CACHED_MESSAGES) return;

  // Sort by createdAt ascending (oldest first)
  allMessages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const toEvict = allMessages.slice(
    0,
    allMessages.length - MAX_CACHED_MESSAGES,
  );
  const tx = db.transaction("messages", "readwrite");
  for (const msg of toEvict) {
    await tx.store.delete(msg.id);
  }
  await tx.done;
}
