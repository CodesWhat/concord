import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import { useReactionStore } from "../../src/stores/reactionStore.ts";

test("reaction store handles add/remove updates from gateway events", () => {
  useReactionStore.setState({ reactions: {} });

  useReactionStore.getState().handleReactionAdd({
    channelId: "c1",
    messageId: "m1",
    userId: "u1",
    emoji: ":+1:",
  });
  useReactionStore.getState().handleReactionAdd({
    channelId: "c1",
    messageId: "m1",
    userId: "u1",
    emoji: ":+1:",
  });
  useReactionStore.getState().handleReactionAdd({
    channelId: "c1",
    messageId: "m1",
    userId: "u2",
    emoji: ":+1:",
  });

  assert.deepEqual(useReactionStore.getState().reactions["m1"], [
    { emoji: ":+1:", count: 2, userIds: ["u1", "u2"] },
  ]);

  useReactionStore.getState().handleReactionRemove({
    channelId: "c1",
    messageId: "m1",
    userId: "u2",
    emoji: ":+1:",
  });
  assert.deepEqual(useReactionStore.getState().reactions["m1"], [
    { emoji: ":+1:", count: 1, userIds: ["u1"] },
  ]);

  useReactionStore.getState().handleReactionRemove({
    channelId: "c1",
    messageId: "m1",
    userId: "u1",
    emoji: ":+1:",
  });
  assert.deepEqual(useReactionStore.getState().reactions["m1"], []);

  useReactionStore.getState().handleReactionRemove({
    channelId: "c1",
    messageId: "m1",
    userId: "u3",
    emoji: ":-1:",
  });
  assert.deepEqual(useReactionStore.getState().reactions["m1"], []);

  useReactionStore.getState().handleReactionRemove({
    channelId: "c1",
    messageId: "unknown-message",
    userId: "u3",
    emoji: ":-1:",
  });
  assert.deepEqual(
    useReactionStore.getState().reactions["unknown-message"],
    [],
  );
});

test("addReaction and removeReaction call API with encoded emoji and swallow errors", async () => {
  const calls: string[] = [];
  const originalPut = api.put;
  const originalDelete = api.delete;

  (api as { put: typeof api.put }).put = (async (path) => {
    calls.push(path);
    return undefined;
  }) as typeof api.put;
  (api as { delete: typeof api.delete }).delete = (async (path) => {
    calls.push(path);
    return undefined;
  }) as typeof api.delete;

  try {
    await useReactionStore.getState().addReaction("c1", "m1", "🔥 hot");
    await useReactionStore.getState().removeReaction("c1", "m1", "🔥 hot");

    (api as { put: typeof api.put }).put = (async () => {
      throw new Error("put fail");
    }) as typeof api.put;
    (api as { delete: typeof api.delete }).delete = (async () => {
      throw new Error("delete fail");
    }) as typeof api.delete;

    await useReactionStore.getState().addReaction("c1", "m1", "🔥 hot");
    await useReactionStore.getState().removeReaction("c1", "m1", "🔥 hot");
  } finally {
    (api as { put: typeof api.put }).put = originalPut;
    (api as { delete: typeof api.delete }).delete = originalDelete;
  }

  assert.deepEqual(calls, [
    "/api/v1/channels/c1/messages/m1/reactions/%F0%9F%94%A5%20hot",
    "/api/v1/channels/c1/messages/m1/reactions/%F0%9F%94%A5%20hot",
  ]);
});

test("fetchReactions updates one message and swallows API errors", async () => {
  useReactionStore.setState({ reactions: {} });
  const originalGet = api.get;

  (api as { get: typeof api.get }).get = (async () => [
    { emoji: "😀", count: 1, userIds: ["u1"] },
  ]) as typeof api.get;

  try {
    await useReactionStore.getState().fetchReactions("c1", "m1");
    assert.deepEqual(useReactionStore.getState().reactions["m1"], [
      { emoji: "😀", count: 1, userIds: ["u1"] },
    ]);

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("get fail");
    }) as typeof api.get;
    await useReactionStore.getState().fetchReactions("c1", "m1");
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("fetchReactionsBatch handles empty input, merges data, and swallows errors", async () => {
  useReactionStore.setState({ reactions: { existing: [{ emoji: "x", count: 1, userIds: ["u"] }] } });
  let postCalls = 0;
  const originalPost = api.post;

  (api as { post: typeof api.post }).post = (async () => {
    postCalls += 1;
    return {
      m1: [{ emoji: "😀", count: 2, userIds: ["u1", "u2"] }],
    };
  }) as typeof api.post;

  try {
    await useReactionStore.getState().fetchReactionsBatch("c1", []);
    assert.equal(postCalls, 0);

    await useReactionStore.getState().fetchReactionsBatch("c1", ["m1"]);
    assert.equal(postCalls, 1);
    assert.deepEqual(useReactionStore.getState().reactions["existing"], [
      { emoji: "x", count: 1, userIds: ["u"] },
    ]);
    assert.deepEqual(useReactionStore.getState().reactions["m1"], [
      { emoji: "😀", count: 2, userIds: ["u1", "u2"] },
    ]);

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("post fail");
    }) as typeof api.post;
    await useReactionStore.getState().fetchReactionsBatch("c1", ["m1"]);
  } finally {
    (api as { post: typeof api.post }).post = originalPost;
  }
});
