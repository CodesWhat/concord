import assert from "node:assert/strict";
import test from "node:test";

import {
  Permissions,
  addPermission,
  hasPermission,
  removePermission,
} from "../src/permissions/index.ts";

test("hasPermission allows any permission when administrator bit is set", () => {
  const adminPermissions = Permissions.ADMINISTRATOR;

  assert.equal(hasPermission(adminPermissions, Permissions.BAN_MEMBERS), true);
  assert.equal(hasPermission(adminPermissions, Permissions.MANAGE_CHANNELS), true);
});

test("hasPermission checks an explicit bit when administrator is not set", () => {
  const memberPermissions = Permissions.READ_MESSAGES | Permissions.SEND_MESSAGES;

  assert.equal(hasPermission(memberPermissions, Permissions.SEND_MESSAGES), true);
  assert.equal(hasPermission(memberPermissions, Permissions.BAN_MEMBERS), false);
});

test("addPermission sets the requested bit", () => {
  const initial = Permissions.READ_MESSAGES;
  const updated = addPermission(initial, Permissions.ATTACH_FILES);

  assert.equal((updated & Permissions.READ_MESSAGES) !== 0, true);
  assert.equal((updated & Permissions.ATTACH_FILES) !== 0, true);
});

test("removePermission clears only the requested bit", () => {
  const initial = Permissions.READ_MESSAGES | Permissions.ATTACH_FILES;
  const updated = removePermission(initial, Permissions.ATTACH_FILES);

  assert.equal((updated & Permissions.READ_MESSAGES) !== 0, true);
  assert.equal((updated & Permissions.ATTACH_FILES) !== 0, false);
});
