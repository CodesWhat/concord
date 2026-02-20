import assert from "node:assert/strict";
import test from "node:test";

import * as shared from "../src/index.ts";

test("index exports permission helpers and constants", () => {
  assert.equal(typeof shared.hasPermission, "function");
  assert.equal(typeof shared.addPermission, "function");
  assert.equal(typeof shared.removePermission, "function");
  assert.equal(typeof shared.resolveChannelPermissions, "function");
  assert.equal(shared.Permissions.ADMINISTRATOR, 1 << 30);
});
