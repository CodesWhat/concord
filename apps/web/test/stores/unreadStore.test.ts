import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import { useUnreadStore } from "../../src/stores/unreadStore.ts";

test("unread store initializes and updates channel counters", () => {
  useUnreadStore.setState({ channels: {} });
  assert.deepEqual(useUnreadStore.getState().getUnreadForChannel("missing"), {
    lastReadMessageId: null,
    unreadCount: 0,
    mentionCount: 0,
  });

  useUnreadStore.getState().initFromReadyPayload([
    { channelId: "c1", lastReadMessageId: "m1", mentionCount: 2 },
  ]);
  assert.deepEqual(useUnreadStore.getState().getUnreadForChannel("c1"), {
    lastReadMessageId: "m1",
    unreadCount: 0,
    mentionCount: 2,
  });

  useUnreadStore.getState().incrementUnread("c1");
  useUnreadStore.getState().incrementMention("c1");
  assert.deepEqual(useUnreadStore.getState().getUnreadForChannel("c1"), {
    lastReadMessageId: "m1",
    unreadCount: 1,
    mentionCount: 3,
  });

  useUnreadStore.getState().incrementUnread("c2");
  assert.deepEqual(useUnreadStore.getState().getUnreadForChannel("c2"), {
    lastReadMessageId: null,
    unreadCount: 1,
    mentionCount: 0,
  });

  useUnreadStore.getState().incrementMention("c3");
  assert.deepEqual(useUnreadStore.getState().getUnreadForChannel("c3"), {
    lastReadMessageId: null,
    unreadCount: 0,
    mentionCount: 1,
  });

  useUnreadStore.getState().handleReadStateUpdate({
    channelId: "c1",
    lastReadMessageId: "m99",
    mentionCount: 7,
  });
  assert.deepEqual(useUnreadStore.getState().getUnreadForChannel("c1"), {
    lastReadMessageId: "m99",
    unreadCount: 0,
    mentionCount: 7,
  });
});

test("markChannelRead performs optimistic update and syncs when API succeeds", async () => {
  useUnreadStore.setState({ channels: {} });
  let call: { path: string; body: unknown } | null = null;
  const originalPut = api.put;
  (api as { put: typeof api.put }).put = (async (path, body) => {
    call = { path, body };
    return undefined;
  }) as typeof api.put;

  try {
    await useUnreadStore.getState().markChannelRead("c1", "m123");
    assert.deepEqual(useUnreadStore.getState().getUnreadForChannel("c1"), {
      lastReadMessageId: "m123",
      unreadCount: 0,
      mentionCount: 0,
    });
    assert.deepEqual(call, {
      path: "/api/v1/channels/c1/read-state",
      body: { messageId: "m123" },
    });
  } finally {
    (api as { put: typeof api.put }).put = originalPut;
  }
});

test("markChannelRead keeps optimistic state when API fails", async () => {
  useUnreadStore.setState({ channels: {} });
  const originalPut = api.put;
  (api as { put: typeof api.put }).put = (async () => {
    throw new Error("network");
  }) as typeof api.put;

  try {
    await useUnreadStore.getState().markChannelRead("c9", "m9");
    assert.deepEqual(useUnreadStore.getState().getUnreadForChannel("c9"), {
      lastReadMessageId: "m9",
      unreadCount: 0,
      mentionCount: 0,
    });
  } finally {
    (api as { put: typeof api.put }).put = originalPut;
  }
});
