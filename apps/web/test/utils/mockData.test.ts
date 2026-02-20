import assert from "node:assert/strict";
import test from "node:test";

import {
  ROLE_COLORS,
  categories,
  currentUser,
  getMemberById,
  getOfflineMembers,
  getOnlineMembers,
  members,
  messages,
  servers,
} from "../../src/utils/mockData.ts";

test("mock data exports expected static structures", () => {
  assert.equal(servers.length > 0, true);
  assert.equal(categories.length > 0, true);
  assert.equal(messages.length > 0, true);
  assert.equal(currentUser.id, "u1");
  assert.equal(ROLE_COLORS.admin, "#EF4444");
});

test("getMemberById finds a member or returns undefined", () => {
  assert.equal(getMemberById("u1")?.displayName, "Nova");
  assert.equal(getMemberById("does-not-exist"), undefined);
});

test("online and offline member helpers partition member list", () => {
  const online = getOnlineMembers();
  const offline = getOfflineMembers();

  assert.ok(online.every((m) => m.status !== "offline"));
  assert.ok(offline.every((m) => m.status === "offline"));
  assert.equal(online.length + offline.length, members.length);
});
