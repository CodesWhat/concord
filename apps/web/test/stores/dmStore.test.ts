import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import { type DmChannel, type DmMessage, useDmStore } from "../../src/stores/dmStore.ts";

function makeDmChannel(id: string): DmChannel {
  return {
    id,
    createdAt: "2026-02-20T00:00:00.000Z",
    participant: {
      id: `u-${id}`,
      username: `user-${id}`,
      displayName: `User ${id}`,
      avatarUrl: null,
      status: "online",
    },
  };
}

function makeDmMessage(id: string, dmChannelId: string): DmMessage {
  return {
    id,
    dmChannelId,
    authorId: "u1",
    content: `message-${id}`,
    attachments: [],
    editedAt: null,
    createdAt: "2026-02-20T00:00:00.000Z",
    author: {
      username: "user",
      displayName: "User",
      avatarUrl: null,
    },
  };
}

function resetDmState() {
  useDmStore.setState({
    dmChannels: [],
    selectedDmChannelId: null,
    messages: [],
    isLoading: false,
    isSending: false,
    unreadCounts: {},
    hasMoreMessages: false,
  });
}

test("fetchDmChannels updates state and handles failures", async () => {
  resetDmState();
  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async () => [
    makeDmChannel("d1"),
  ]) as typeof api.get;

  try {
    await useDmStore.getState().fetchDmChannels();
    assert.equal(useDmStore.getState().dmChannels.length, 1);
    assert.equal(useDmStore.getState().isLoading, false);

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("channels fail");
    }) as typeof api.get;
    await useDmStore.getState().fetchDmChannels();
    assert.equal(useDmStore.getState().isLoading, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("openDm returns channel id on success and null on failure", async () => {
  resetDmState();
  const originalPost = api.post;
  const originalFetchDmChannels = useDmStore.getState().fetchDmChannels;
  const originalFetchMessages = useDmStore.getState().fetchMessages;
  let fetchedChannels = 0;
  let fetchedMessagesFor = "";

  useDmStore.setState({
    fetchDmChannels: async () => {
      fetchedChannels += 1;
    },
    fetchMessages: async (id: string) => {
      fetchedMessagesFor = id;
    },
  });

  (api as { post: typeof api.post }).post = (async () => ({ id: "d1" })) as typeof api.post;

  try {
    const id = await useDmStore.getState().openDm("recipient-1");
    assert.equal(id, "d1");
    assert.equal(useDmStore.getState().selectedDmChannelId, "d1");
    assert.equal(fetchedChannels, 1);
    assert.equal(fetchedMessagesFor, "d1");

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("open fail");
    }) as typeof api.post;
    const failed = await useDmStore.getState().openDm("recipient-1");
    assert.equal(failed, null);
  } finally {
    (api as { post: typeof api.post }).post = originalPost;
    useDmStore.setState({
      fetchDmChannels: originalFetchDmChannels,
      fetchMessages: originalFetchMessages,
    });
  }
});

test("selectDmChannel clears unread count and fetches messages", () => {
  resetDmState();
  let fetchedId = "";
  const originalFetchMessages = useDmStore.getState().fetchMessages;
  useDmStore.setState({
    unreadCounts: { d1: 4 },
    fetchMessages: async (id: string) => {
      fetchedId = id;
    },
  });

  useDmStore.getState().selectDmChannel("d1");
  assert.equal(useDmStore.getState().selectedDmChannelId, "d1");
  assert.equal(useDmStore.getState().unreadCounts.d1, 0);
  assert.equal(fetchedId, "d1");

  useDmStore.setState({ fetchMessages: originalFetchMessages });
});

test("fetchMessages handles success and failure states", async () => {
  resetDmState();
  const originalGet = api.get;
  const fifty = Array.from({ length: 50 }, (_, i) => makeDmMessage(`m${i}`, "d1"));

  (api as { get: typeof api.get }).get = (async () => fifty) as typeof api.get;

  try {
    await useDmStore.getState().fetchMessages("d1");
    assert.equal(useDmStore.getState().messages[0]?.id, "m49");
    assert.equal(useDmStore.getState().hasMoreMessages, true);
    assert.equal(useDmStore.getState().isLoading, false);

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("fetch fail");
    }) as typeof api.get;
    await useDmStore.getState().fetchMessages("d1");
    assert.equal(useDmStore.getState().isLoading, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("sendMessage toggles isSending and swallows failures", async () => {
  resetDmState();
  const originalPost = api.post;
  const calls: Array<{ path: string; body: unknown }> = [];

  (api as { post: typeof api.post }).post = (async (path, body) => {
    calls.push({ path, body });
    return makeDmMessage("m1", "d1");
  }) as typeof api.post;

  try {
    await useDmStore.getState().sendMessage("d1", "hello");
    assert.equal(useDmStore.getState().isSending, false);
    assert.deepEqual(calls, [
      {
        path: "/api/v1/dms/d1/messages",
        body: { content: "hello" },
      },
    ]);

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("send fail");
    }) as typeof api.post;
    await useDmStore.getState().sendMessage("d1", "hello");
    assert.equal(useDmStore.getState().isSending, false);
  } finally {
    (api as { post: typeof api.post }).post = originalPost;
  }
});

test("loadMoreMessages handles early return, pagination, and failures", async () => {
  resetDmState();
  const originalGet = api.get;
  let calls = 0;

  (api as { get: typeof api.get }).get = (async () => {
    calls += 1;
    if (calls === 1) return [];
    if (calls === 2) return Array.from({ length: 50 }, (_, i) => makeDmMessage(`o${i}`, "d1"));
    throw new Error("older fail");
  }) as typeof api.get;

  try {
    await useDmStore.getState().loadMoreMessages("d1");
    assert.equal(calls, 0);

    useDmStore.setState({ messages: [undefined as unknown as DmMessage] });
    await useDmStore.getState().loadMoreMessages("d1");
    assert.equal(calls, 0);

    useDmStore.setState({ messages: [makeDmMessage("m5", "d1")] });
    await useDmStore.getState().loadMoreMessages("d1");
    assert.equal(useDmStore.getState().hasMoreMessages, false);
    assert.equal(calls, 1);

    useDmStore.setState({ messages: [makeDmMessage("m6", "d1")] });
    await useDmStore.getState().loadMoreMessages("d1");
    assert.equal(useDmStore.getState().hasMoreMessages, true);
    assert.equal(useDmStore.getState().messages.length, 51);
    assert.equal(calls, 2);

    await useDmStore.getState().loadMoreMessages("d1");
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("addDmMessage handles selected channel, dedupe, and unread increment", () => {
  resetDmState();
  useDmStore.setState({
    dmChannels: [makeDmChannel("d1"), makeDmChannel("d2")],
    selectedDmChannelId: "d1",
    messages: [],
    unreadCounts: {},
  });

  const message = makeDmMessage("m1", "d1");
  useDmStore.getState().addDmMessage(message);
  useDmStore.getState().addDmMessage(message);
  assert.equal(useDmStore.getState().messages.length, 1);
  assert.equal(useDmStore.getState().dmChannels[0]?.lastMessage?.content, "message-m1");

  const otherMessage = makeDmMessage("m2", "d2");
  useDmStore.getState().addDmMessage(otherMessage);
  assert.equal(useDmStore.getState().unreadCounts.d2, 1);
  assert.equal(useDmStore.getState().dmChannels[1]?.lastMessage?.content, "message-m2");
});
