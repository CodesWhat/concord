import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import { useServerStore } from "../../src/stores/serverStore.ts";

function makeServer(id: string) {
  return {
    id,
    name: `server-${id}`,
    iconUrl: null,
    ownerId: "u1",
    description: null,
    createdAt: "2026-02-20T00:00:00.000Z",
  };
}

function makeMember(id: string) {
  return {
    userId: id,
    nickname: null,
    joinedAt: "2026-02-20T00:00:00.000Z",
    user: {
      username: `user-${id}`,
      displayName: `User ${id}`,
      avatarUrl: null,
      status: "online",
    },
    roles: [],
  };
}

function makeRole(id: string) {
  return {
    id,
    serverId: "s1",
    name: `role-${id}`,
    color: null,
    position: 1,
    permissions: 0,
    mentionable: false,
    hoisted: false,
  };
}

function makeBan(userId: string) {
  return {
    userId,
    serverId: "s1",
    reason: null,
    bannedBy: "u1",
    createdAt: "2026-02-20T00:00:00.000Z",
    user: {
      username: "user",
      displayName: "User",
      avatarUrl: null,
    },
  };
}

function resetServerState() {
  useServerStore.setState({
    servers: [],
    selectedServerId: null,
    members: [],
    roles: [],
    bans: [],
    isLoading: false,
  });
}

test("server list fetch/select/create flows", async () => {
  resetServerState();
  const originalGet = api.get;
  const originalPost = api.post;

  (api as { get: typeof api.get }).get = (async () => [makeServer("s1")]) as typeof api.get;
  (api as { post: typeof api.post }).post = (async () => makeServer("s2")) as typeof api.post;

  try {
    await useServerStore.getState().fetchServers();
    assert.equal(useServerStore.getState().servers.length, 1);
    assert.equal(useServerStore.getState().isLoading, false);

    useServerStore.getState().selectServer("s1");
    assert.equal(useServerStore.getState().selectedServerId, "s1");

    await useServerStore.getState().createServer("new");
    assert.equal(useServerStore.getState().servers.length, 2);
    assert.equal(useServerStore.getState().selectedServerId, "s2");

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("fetch servers fail");
    }) as typeof api.get;
    await useServerStore.getState().fetchServers();
    assert.equal(useServerStore.getState().isLoading, false);

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("create server fail");
    }) as typeof api.post;
    await useServerStore.getState().createServer("new");
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
    (api as { post: typeof api.post }).post = originalPost;
  }
});

test("member and role fetch/update/delete flows", async () => {
  resetServerState();
  const originalGet = api.get;
  const originalPost = api.post;
  const originalPatch = api.patch;
  const originalDelete = api.delete;
  const originalPut = api.put;

  (api as { get: typeof api.get }).get = (async (path) => {
    if (path.endsWith("/members")) return [makeMember("u1")];
    if (path.endsWith("/roles")) return [makeRole("r1")];
    if (path.endsWith("/bans")) return [makeBan("u9")];
    return [];
  }) as typeof api.get;

  (api as { post: typeof api.post }).post = (async (path) => {
    if (path.endsWith("/roles")) return makeRole("r2");
    return undefined;
  }) as typeof api.post;

  (api as { patch: typeof api.patch }).patch = (async () => makeRole("r1-updated")) as typeof api.patch;
  (api as { delete: typeof api.delete }).delete = (async () => undefined) as typeof api.delete;
  (api as { put: typeof api.put }).put = (async () => undefined) as typeof api.put;

  try {
    await useServerStore.getState().fetchMembers("s1");
    assert.equal(useServerStore.getState().members.length, 1);

    await useServerStore.getState().fetchRoles("s1");
    assert.equal(useServerStore.getState().roles.length, 1);

    const createdRole = await useServerStore.getState().createRole("s1", "mod");
    assert.equal(createdRole?.id, "r2");
    assert.equal(useServerStore.getState().roles[0]?.id, "r2");

    await useServerStore.getState().updateRole("s1", "r2", { name: "x" });
    assert.equal(useServerStore.getState().roles[0]?.id, "r2");

    await useServerStore.getState().deleteRole("s1", "r2");
    assert.deepEqual(useServerStore.getState().roles.map((r) => r.id), ["r1"]);

    await useServerStore.getState().assignRole("s1", "u1", "r1");
    await useServerStore.getState().removeRole("s1", "u1", "r1");

    await useServerStore.getState().fetchBans("s1");
    assert.equal(useServerStore.getState().bans.length, 1);

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("get fail");
    }) as typeof api.get;
    await useServerStore.getState().fetchMembers("s1");
    await useServerStore.getState().fetchRoles("s1");
    await useServerStore.getState().fetchBans("s1");

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("post fail");
    }) as typeof api.post;
    assert.equal(await useServerStore.getState().createRole("s1", "mod"), null);

    (api as { patch: typeof api.patch }).patch = (async () => {
      throw new Error("patch fail");
    }) as typeof api.patch;
    await useServerStore.getState().updateRole("s1", "r1", { name: "x" });

    (api as { delete: typeof api.delete }).delete = (async () => {
      throw new Error("delete fail");
    }) as typeof api.delete;
    await useServerStore.getState().deleteRole("s1", "r1");
    await useServerStore.getState().removeRole("s1", "u1", "r1");

    (api as { put: typeof api.put }).put = (async () => {
      throw new Error("put fail");
    }) as typeof api.put;
    await useServerStore.getState().assignRole("s1", "u1", "r1");
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
    (api as { post: typeof api.post }).post = originalPost;
    (api as { patch: typeof api.patch }).patch = originalPatch;
    (api as { delete: typeof api.delete }).delete = originalDelete;
    (api as { put: typeof api.put }).put = originalPut;
  }
});

test("leave, kick, ban, and unban flows return expected booleans", async () => {
  resetServerState();
  useServerStore.setState({
    servers: [makeServer("s1"), makeServer("s2")],
    selectedServerId: "s1",
    members: [makeMember("u1"), makeMember("u2")],
    bans: [makeBan("u9"), makeBan("u8")],
  });

  const originalPost = api.post;
  const originalDelete = api.delete;
  (api as { post: typeof api.post }).post = (async () => undefined) as typeof api.post;
  (api as { delete: typeof api.delete }).delete = (async () => undefined) as typeof api.delete;

  try {
    await useServerStore.getState().leaveServer("s1");
    assert.deepEqual(useServerStore.getState().servers.map((s) => s.id), ["s2"]);
    assert.equal(useServerStore.getState().selectedServerId, null);

    assert.equal(await useServerStore.getState().kickMember("s2", "u1"), true);
    assert.equal(await useServerStore.getState().banMember("s2", "u2", "spam"), true);
    assert.equal(await useServerStore.getState().unbanMember("s2", "u9"), true);
    assert.deepEqual(useServerStore.getState().bans.map((b) => b.userId), ["u8"]);

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("post fail");
    }) as typeof api.post;
    assert.equal(await useServerStore.getState().kickMember("s2", "u1"), false);
    assert.equal(await useServerStore.getState().banMember("s2", "u1"), false);

    (api as { delete: typeof api.delete }).delete = (async () => {
      throw new Error("delete fail");
    }) as typeof api.delete;
    assert.equal(await useServerStore.getState().unbanMember("s2", "u8"), false);
  } finally {
    (api as { post: typeof api.post }).post = originalPost;
    (api as { delete: typeof api.delete }).delete = originalDelete;
  }
});
