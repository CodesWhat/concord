import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import {
  type Thread,
  type ThreadMessage,
  useThreadStore,
} from "../../src/stores/threadStore.ts";

function resetThreadState() {
  useThreadStore.setState({
    activeThreadId: null,
    threads: [],
    threadMessages: [],
    isLoading: false,
  });
}

test("openThread and closeThread manage active thread state", () => {
  resetThreadState();
  const originalFetchThreadMessages = useThreadStore.getState().fetchThreadMessages;
  let fetchedThreadId = "";
  useThreadStore.setState({
    fetchThreadMessages: async (threadId: string) => {
      fetchedThreadId = threadId;
    },
  });

  useThreadStore.setState({ threadMessages: [{ id: "old" } as never] });
  useThreadStore.getState().openThread("t1");
  assert.equal(useThreadStore.getState().activeThreadId, "t1");
  assert.deepEqual(useThreadStore.getState().threadMessages, []);
  assert.equal(fetchedThreadId, "t1");

  useThreadStore.getState().closeThread();
  assert.equal(useThreadStore.getState().activeThreadId, null);
  assert.deepEqual(useThreadStore.getState().threadMessages, []);

  useThreadStore.setState({
    fetchThreadMessages: originalFetchThreadMessages,
  });
});

test("fetchChannelThreads stores results and handles failures", async () => {
  resetThreadState();
  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async () => [
    {
      id: "t1",
      parentMessageId: "m1",
      channelId: "c1",
      name: "thread",
      archived: false,
      messageCount: 1,
      createdAt: "2026-02-20T00:00:00.000Z",
    },
  ]) as typeof api.get;

  try {
    await useThreadStore.getState().fetchChannelThreads("c1");
    assert.equal(useThreadStore.getState().threads.length, 1);

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("fail");
    }) as typeof api.get;
    await useThreadStore.getState().fetchChannelThreads("c1");
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("fetchThreadMessages updates loading state for success and failure", async () => {
  resetThreadState();
  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async () => [
    {
      id: "tm1",
      channelId: "c1",
      authorId: "u1",
      content: "hello",
      attachments: [],
      replyToId: null,
      threadId: "t1",
      editedAt: null,
      deleted: false,
      createdAt: "2026-02-20T00:00:00.000Z",
      author: { username: "u", displayName: "U", avatarUrl: null },
    },
  ]) as typeof api.get;

  try {
    await useThreadStore.getState().fetchThreadMessages("t1");
    assert.equal(useThreadStore.getState().isLoading, false);
    assert.equal(useThreadStore.getState().threadMessages.length, 1);

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("fail");
    }) as typeof api.get;
    await useThreadStore.getState().fetchThreadMessages("t1");
    assert.equal(useThreadStore.getState().isLoading, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("createThread returns thread on success and null on failure", async () => {
  resetThreadState();
  const originalPost = api.post;
  (api as { post: typeof api.post }).post = (async () => ({
    id: "t1",
    parentMessageId: "m1",
    channelId: "c1",
    name: "thread",
    archived: false,
    messageCount: 0,
    createdAt: "2026-02-20T00:00:00.000Z",
  })) as typeof api.post;

  try {
    const created = await useThreadStore
      .getState()
      .createThread("c1", "m1", "thread");
    assert.equal(created?.id, "t1");
    assert.equal(useThreadStore.getState().threads.length, 1);

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("fail");
    }) as typeof api.post;
    const failed = await useThreadStore
      .getState()
      .createThread("c1", "m1", "thread");
    assert.equal(failed, null);
  } finally {
    (api as { post: typeof api.post }).post = originalPost;
  }
});

test("sendThreadMessage sends optional replyToId and swallows failures", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const originalPost = api.post;
  (api as { post: typeof api.post }).post = (async (path, body) => {
    calls.push({ path, body });
    return undefined;
  }) as typeof api.post;

  try {
    await useThreadStore.getState().sendThreadMessage("t1", "hello");
    await useThreadStore.getState().sendThreadMessage("t1", "hello", "m9");
    assert.deepEqual(calls, [
      {
        path: "/api/v1/threads/t1/messages",
        body: { content: "hello" },
      },
      {
        path: "/api/v1/threads/t1/messages",
        body: { content: "hello", replyToId: "m9" },
      },
    ]);

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("fail");
    }) as typeof api.post;
    await useThreadStore.getState().sendThreadMessage("t1", "hello");
  } finally {
    (api as { post: typeof api.post }).post = originalPost;
  }
});

test("addThreadMessage, updateThread, and addThread handle dedupe paths", () => {
  resetThreadState();
  const baseThread: Thread = {
    id: "t1",
    parentMessageId: "m1",
    channelId: "c1",
    name: "thread",
    archived: false,
    messageCount: 0,
    createdAt: "2026-02-20T00:00:00.000Z",
  };
  const otherThread: Thread = {
    id: "t2",
    parentMessageId: "m2",
    channelId: "c1",
    name: "other",
    archived: false,
    messageCount: 0,
    createdAt: "2026-02-20T00:00:00.000Z",
  };
  const message: ThreadMessage = {
    id: "tm1",
    channelId: "c1",
    authorId: "u1",
    content: "hello",
    attachments: [],
    replyToId: null,
    threadId: "t1",
    editedAt: null,
    deleted: false,
    createdAt: "2026-02-20T00:00:00.000Z",
    author: { username: "u", displayName: "U", avatarUrl: null },
  };

  useThreadStore.getState().addThread(baseThread);
  useThreadStore.getState().addThread(otherThread);
  useThreadStore.getState().addThread(baseThread);
  assert.equal(useThreadStore.getState().threads.length, 2);

  useThreadStore.getState().updateThread({ ...baseThread, name: "updated" });
  assert.equal(useThreadStore.getState().threads[0]?.name, "updated");
  assert.equal(useThreadStore.getState().threads[1]?.name, "other");

  useThreadStore.setState({ activeThreadId: "other" });
  useThreadStore.getState().addThreadMessage(message);
  assert.equal(useThreadStore.getState().threadMessages.length, 0);

  useThreadStore.setState({ activeThreadId: "t1" });
  useThreadStore.getState().addThreadMessage(message);
  useThreadStore.getState().addThreadMessage(message);
  assert.equal(useThreadStore.getState().threadMessages.length, 1);
});
