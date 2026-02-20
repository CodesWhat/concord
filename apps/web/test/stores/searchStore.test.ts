import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import { useSearchStore } from "../../src/stores/searchStore.ts";

function resetSearchState() {
  useSearchStore.setState({
    results: [],
    isSearching: false,
    query: "",
    isOpen: false,
    offset: 0,
    hasMore: false,
  });
}

test("search resets for empty query without calling API", async () => {
  resetSearchState();
  let called = false;
  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async () => {
    called = true;
    return [];
  }) as typeof api.get;

  try {
    await useSearchStore.getState().search("s1", "   ");
    assert.equal(called, false);
    assert.deepEqual(useSearchStore.getState().results, []);
    assert.equal(useSearchStore.getState().query, "");
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("search stores results and supports optional channel filter", async () => {
  resetSearchState();
  let calledPath = "";
  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async (path) => {
    calledPath = path;
    return [
      {
        id: "m1",
        channelId: "c1",
        channelName: "general",
        authorId: "u1",
        author: { username: "user", displayName: "User", avatarUrl: null },
        content: "hello",
        createdAt: "2026-02-20T00:00:00.000Z",
        highlight: "hello",
      },
    ];
  }) as typeof api.get;

  try {
    await useSearchStore.getState().search("s1", " hello ", { channelId: "c1" });
    assert.equal(calledPath.includes("q=hello"), true);
    assert.equal(calledPath.includes("channelId=c1"), true);
    assert.equal(useSearchStore.getState().query, "hello");
    assert.equal(useSearchStore.getState().offset, 1);
    assert.equal(useSearchStore.getState().hasMore, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("search handles failures by clearing loading and results", async () => {
  resetSearchState();
  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async () => {
    throw new Error("search fail");
  }) as typeof api.get;

  try {
    await useSearchStore.getState().search("s1", "hello");
    assert.deepEqual(useSearchStore.getState().results, []);
    assert.equal(useSearchStore.getState().isSearching, false);
    assert.equal(useSearchStore.getState().offset, 0);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("loadMore returns early when query is empty or search is in progress", async () => {
  resetSearchState();
  let called = false;
  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async () => {
    called = true;
    return [];
  }) as typeof api.get;

  try {
    await useSearchStore.getState().loadMore("s1");
    assert.equal(called, false);

    useSearchStore.setState({ query: "q", isSearching: true });
    await useSearchStore.getState().loadMore("s1");
    assert.equal(called, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("loadMore appends results and handles errors", async () => {
  resetSearchState();
  useSearchStore.setState({
    query: "hello",
    results: [
      {
        id: "m0",
        channelId: "c1",
        channelName: "general",
        authorId: "u0",
        author: { username: "u0", displayName: "U0", avatarUrl: null },
        content: "seed",
        createdAt: "2026-02-20T00:00:00.000Z",
        highlight: "seed",
      },
    ],
    offset: 1,
    isSearching: false,
  });

  const batch = Array.from({ length: 25 }).map((_, i) => ({
    id: `m${i + 1}`,
    channelId: "c1",
    channelName: "general",
    authorId: `u${i + 1}`,
    author: { username: "u", displayName: "U", avatarUrl: null },
    content: "more",
    createdAt: "2026-02-20T00:00:00.000Z",
    highlight: "more",
  }));

  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async () => batch) as typeof api.get;

  try {
    await useSearchStore.getState().loadMore("s1");
    assert.equal(useSearchStore.getState().results.length, 26);
    assert.equal(useSearchStore.getState().offset, 26);
    assert.equal(useSearchStore.getState().hasMore, true);

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("load more fail");
    }) as typeof api.get;
    await useSearchStore.getState().loadMore("s1");
    assert.equal(useSearchStore.getState().isSearching, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("search panel open/close and clearSearch update state", () => {
  resetSearchState();
  useSearchStore.setState({ results: [{ id: "m1" } as never], query: "x", offset: 1, hasMore: true });

  useSearchStore.getState().open();
  assert.equal(useSearchStore.getState().isOpen, true);

  useSearchStore.getState().clearSearch();
  assert.deepEqual(useSearchStore.getState().results, []);
  assert.equal(useSearchStore.getState().query, "");
  assert.equal(useSearchStore.getState().offset, 0);
  assert.equal(useSearchStore.getState().hasMore, false);

  useSearchStore.getState().close();
  assert.equal(useSearchStore.getState().isOpen, false);
  assert.deepEqual(useSearchStore.getState().results, []);
});
