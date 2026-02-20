import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import { useAuditStore } from "../../src/stores/auditStore.ts";

function makeEntry(id: string) {
  return {
    id,
    serverId: "s1",
    actorId: "u1",
    action: "role.update",
    targetType: "role",
    targetId: "r1",
    changes: {},
    reason: null,
    createdAt: "2026-02-20T00:00:00.000Z",
  };
}

function resetAuditState() {
  useAuditStore.setState({
    entries: [],
    isLoading: false,
    hasMore: true,
    filter: {},
  });
}

test("fetchAuditLog builds query params and updates state", async () => {
  resetAuditState();
  const originalGet = api.get;
  const calls: string[] = [];

  (api as { get: typeof api.get }).get = (async (path) => {
    calls.push(path);
    return Array.from({ length: 50 }, (_, i) => makeEntry(`e${i}`));
  }) as typeof api.get;

  try {
    useAuditStore.getState().setFilter({ action: "role.update", actorId: "u1" });
    await useAuditStore.getState().fetchAuditLog("s1");
    assert.equal(useAuditStore.getState().entries.length, 50);
    assert.equal(useAuditStore.getState().hasMore, true);
    assert.equal(useAuditStore.getState().isLoading, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }

  assert.equal(calls[0]?.includes("action=role.update"), true);
  assert.equal(calls[0]?.includes("actorId=u1"), true);
  assert.equal(calls[0]?.includes("limit=50"), true);
});

test("fetchAuditLog also supports empty query string path", async () => {
  resetAuditState();
  const originalGet = api.get;
  const originalToString = URLSearchParams.prototype.toString;
  let calledPath = "";

  (api as { get: typeof api.get }).get = (async (path) => {
    calledPath = path;
    return [];
  }) as typeof api.get;
  URLSearchParams.prototype.toString = function toStringOverride() {
    return "";
  };

  try {
    await useAuditStore.getState().fetchAuditLog("s1");
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
    URLSearchParams.prototype.toString = originalToString;
  }

  assert.equal(calledPath, "/api/v1/servers/s1/audit-log");
});

test("loadMore handles guards and appends entries", async () => {
  resetAuditState();
  const originalGet = api.get;
  let calls = 0;
  (api as { get: typeof api.get }).get = (async () => {
    calls += 1;
    return [makeEntry("e2")];
  }) as typeof api.get;

  try {
    await useAuditStore.getState().loadMore("s1");
    assert.equal(calls, 0);

    useAuditStore.setState({ entries: [makeEntry("e1")], isLoading: true });
    await useAuditStore.getState().loadMore("s1");
    assert.equal(calls, 0);

    useAuditStore.setState({
      entries: [makeEntry("e1")],
      isLoading: false,
      hasMore: false,
    });
    await useAuditStore.getState().loadMore("s1");
    assert.equal(calls, 0);

    useAuditStore.setState({
      entries: [makeEntry("e1")],
      isLoading: false,
      hasMore: true,
      filter: { action: "role.update", actorId: "u1" },
    });
    await useAuditStore.getState().loadMore("s1");
    assert.equal(calls, 1);
    assert.equal(useAuditStore.getState().entries.length, 2);
    assert.equal(useAuditStore.getState().isLoading, false);
    assert.equal(useAuditStore.getState().hasMore, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("reset clears entries, loading, hasMore, and filter", () => {
  resetAuditState();
  useAuditStore.setState({
    entries: [makeEntry("e1")],
    isLoading: true,
    hasMore: false,
    filter: { action: "role.update" },
  });

  useAuditStore.getState().reset();
  assert.deepEqual(useAuditStore.getState().entries, []);
  assert.equal(useAuditStore.getState().isLoading, false);
  assert.equal(useAuditStore.getState().hasMore, true);
  assert.deepEqual(useAuditStore.getState().filter, {});
});
