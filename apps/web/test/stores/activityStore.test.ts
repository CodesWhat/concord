import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import { useActivityStore } from "../../src/stores/activityStore.ts";

function makeItem(id: string) {
  return {
    type: "mention" as const,
    messageId: id,
    channelId: "c1",
    channelName: "general",
    serverId: "s1",
    content: "hello",
    author: {
      id: "u1",
      username: "user",
      displayName: "User",
      avatarUrl: null,
    },
    createdAt: "2026-02-20T00:00:00.000Z",
  };
}

function resetActivityState() {
  useActivityStore.setState({
    items: [],
    isLoading: false,
    hasMore: true,
    isOpen: false,
    filter: "all",
  });
}

test("activity panel open/close/toggle and setFilter trigger fetches", () => {
  resetActivityState();
  const originalFetch = useActivityStore.getState().fetchActivity;
  let fetchCount = 0;
  useActivityStore.setState({
    fetchActivity: async () => {
      fetchCount += 1;
    },
  });

  useActivityStore.getState().open();
  assert.equal(useActivityStore.getState().isOpen, true);
  assert.equal(fetchCount, 1);

  useActivityStore.getState().toggle();
  assert.equal(useActivityStore.getState().isOpen, false);
  assert.equal(fetchCount, 1);

  useActivityStore.getState().toggle();
  assert.equal(useActivityStore.getState().isOpen, true);
  assert.equal(fetchCount, 2);

  useActivityStore.getState().setFilter("mentions");
  assert.equal(useActivityStore.getState().filter, "mentions");
  assert.deepEqual(useActivityStore.getState().items, []);
  assert.equal(fetchCount, 3);

  useActivityStore.getState().close();
  assert.equal(useActivityStore.getState().isOpen, false);

  useActivityStore.setState({ fetchActivity: originalFetch });
});

test("fetchActivity maps filters to query params and handles failures", async () => {
  resetActivityState();
  const originalGet = api.get;
  const calls: string[] = [];
  let callIndex = 0;
  (api as { get: typeof api.get }).get = (async (path) => {
    calls.push(path);
    callIndex += 1;
    if (callIndex === 1) return Array.from({ length: 30 }, (_, i) => makeItem(`m${i}`));
    if (callIndex === 5) throw new Error("fetch fail");
    return [makeItem(`m${callIndex}`)];
  }) as typeof api.get;

  try {
    useActivityStore.setState({ filter: "mentions" });
    await useActivityStore.getState().fetchActivity();
    assert.equal(useActivityStore.getState().hasMore, true);

    useActivityStore.setState({ filter: "replies" });
    await useActivityStore.getState().fetchActivity();

    useActivityStore.setState({ filter: "reactions" });
    await useActivityStore.getState().fetchActivity();

    useActivityStore.setState({ filter: "all" });
    await useActivityStore.getState().fetchActivity();
    assert.equal(useActivityStore.getState().hasMore, false);

    await useActivityStore.getState().fetchActivity();
    assert.equal(useActivityStore.getState().isLoading, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }

  assert.equal(calls[0]?.includes("limit=30&type=mention"), true);
  assert.equal(calls[1]?.includes("limit=30&type=reply"), true);
  assert.equal(calls[2]?.includes("limit=30&type=reaction"), true);
  assert.equal(calls[3], "/api/v1/users/@me/activity?limit=30");
});

test("loadMore handles empty state, success, and failures", async () => {
  resetActivityState();
  const originalGet = api.get;
  let calls = 0;
  (api as { get: typeof api.get }).get = (async () => {
    calls += 1;
    return [makeItem("m-next")];
  }) as typeof api.get;

  try {
    await useActivityStore.getState().loadMore();
    assert.equal(calls, 0);

    useActivityStore.setState({
      filter: "reactions",
      items: [makeItem("m1")],
    });
    await useActivityStore.getState().loadMore();
    assert.equal(useActivityStore.getState().items.length, 2);
    assert.equal(calls, 1);

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("more fail");
    }) as typeof api.get;
    await useActivityStore.getState().loadMore();
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});
