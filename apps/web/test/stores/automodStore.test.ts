import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import { useAutomodStore } from "../../src/stores/automodStore.ts";

function makeRule(id: string, enabled = true) {
  return {
    id,
    serverId: "s1",
    type: "word_filter" as const,
    name: `rule-${id}`,
    enabled,
    config: {},
    action: "block",
    createdAt: "2026-02-20T00:00:00.000Z",
    updatedAt: "2026-02-20T00:00:00.000Z",
  };
}

function resetAutomodState() {
  useAutomodStore.setState({
    rules: [],
    isLoading: false,
  });
}

test("fetchRules updates rules and always resets loading", async () => {
  resetAutomodState();
  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async () => [
    makeRule("r1"),
  ]) as typeof api.get;

  try {
    await useAutomodStore.getState().fetchRules("s1");
    assert.equal(useAutomodStore.getState().rules.length, 1);
    assert.equal(useAutomodStore.getState().isLoading, false);

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("fetch fail");
    }) as typeof api.get;
    await useAutomodStore.getState().fetchRules("s1");
    assert.equal(useAutomodStore.getState().isLoading, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("createRule and updateRule refresh list and rethrow on failure", async () => {
  resetAutomodState();
  const originalPost = api.post;
  const originalPatch = api.patch;
  let postCalls = 0;
  let patchCalls = 0;
  let fetchCalls = 0;
  const originalFetchRules = useAutomodStore.getState().fetchRules;

  useAutomodStore.setState({
    fetchRules: async () => {
      fetchCalls += 1;
    },
  });

  (api as { post: typeof api.post }).post = (async () => {
    postCalls += 1;
    return undefined;
  }) as typeof api.post;
  (api as { patch: typeof api.patch }).patch = (async () => {
    patchCalls += 1;
    return undefined;
  }) as typeof api.patch;

  try {
    await useAutomodStore.getState().createRule("s1", { name: "a" });
    await useAutomodStore.getState().updateRule("s1", "r1", { name: "b" });
    assert.equal(postCalls, 1);
    assert.equal(patchCalls, 1);
    assert.equal(fetchCalls, 2);

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("create fail");
    }) as typeof api.post;
    await assert.rejects(
      useAutomodStore.getState().createRule("s1", { name: "x" }),
    );

    (api as { patch: typeof api.patch }).patch = (async () => {
      throw new Error("update fail");
    }) as typeof api.patch;
    await assert.rejects(
      useAutomodStore.getState().updateRule("s1", "r1", { name: "x" }),
    );
  } finally {
    (api as { post: typeof api.post }).post = originalPost;
    (api as { patch: typeof api.patch }).patch = originalPatch;
    useAutomodStore.setState({ fetchRules: originalFetchRules });
  }
});

test("deleteRule and toggleRule update local state and rethrow on failures", async () => {
  resetAutomodState();
  useAutomodStore.setState({ rules: [makeRule("r1"), makeRule("r2")] });
  const originalDelete = api.delete;
  const originalPatch = api.patch;

  (api as { delete: typeof api.delete }).delete = (async () => {
    return undefined;
  }) as typeof api.delete;
  (api as { patch: typeof api.patch }).patch = (async () => {
    return undefined;
  }) as typeof api.patch;

  try {
    await useAutomodStore.getState().deleteRule("s1", "r1");
    assert.deepEqual(
      useAutomodStore.getState().rules.map((r) => r.id),
      ["r2"],
    );

    await useAutomodStore.getState().toggleRule("s1", "r2", false);
    assert.equal(useAutomodStore.getState().rules[0]?.enabled, false);

    (api as { delete: typeof api.delete }).delete = (async () => {
      throw new Error("delete fail");
    }) as typeof api.delete;
    await assert.rejects(useAutomodStore.getState().deleteRule("s1", "r2"));

    (api as { patch: typeof api.patch }).patch = (async () => {
      throw new Error("toggle fail");
    }) as typeof api.patch;
    await assert.rejects(
      useAutomodStore.getState().toggleRule("s1", "r2", true),
    );
  } finally {
    (api as { delete: typeof api.delete }).delete = originalDelete;
    (api as { patch: typeof api.patch }).patch = originalPatch;
  }
});
