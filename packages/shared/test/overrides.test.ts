import assert from "node:assert/strict";
import test from "node:test";

import { Permissions } from "../src/permissions/index.ts";
import { resolveChannelPermissions } from "../src/permissions/overrides.ts";

test("resolveChannelPermissions bypasses overrides for administrators", () => {
  const base = Permissions.ADMINISTRATOR | Permissions.SEND_MESSAGES;
  const resolved = resolveChannelPermissions(
    base,
    ["member", "mod"],
    {
      mod: { allow: 0, deny: Permissions.SEND_MESSAGES },
    },
    {
      member: { allow: 0, deny: Permissions.SEND_MESSAGES },
    },
  );

  assert.equal(resolved, base);
});

test("resolveChannelPermissions applies category and channel overrides in order", () => {
  const base = Permissions.READ_MESSAGES;
  const resolved = resolveChannelPermissions(
    base,
    ["member", "helper"],
    {
      member: { allow: Permissions.SEND_MESSAGES, deny: 0 },
      helper: { allow: Permissions.ATTACH_FILES, deny: 0 },
    },
    {
      member: { allow: 0, deny: Permissions.SEND_MESSAGES },
      helper: { allow: Permissions.ADD_REACTIONS, deny: 0 },
    },
  );

  assert.equal((resolved & Permissions.READ_MESSAGES) !== 0, true);
  assert.equal((resolved & Permissions.SEND_MESSAGES) !== 0, false);
  assert.equal((resolved & Permissions.ATTACH_FILES) !== 0, true);
  assert.equal((resolved & Permissions.ADD_REACTIONS) !== 0, true);
});

test("resolveChannelPermissions gives deny precedence over allow for same bit", () => {
  const base = Permissions.READ_MESSAGES | Permissions.SEND_MESSAGES;
  const resolved = resolveChannelPermissions(
    base,
    ["member"],
    {
      member: {
        allow: Permissions.SEND_MESSAGES,
        deny: Permissions.SEND_MESSAGES,
      },
    },
    null,
  );

  assert.equal((resolved & Permissions.SEND_MESSAGES) !== 0, false);
});

test("resolveChannelPermissions ignores unknown role overrides and handles nullish inputs", () => {
  const base = Permissions.READ_MESSAGES;
  const resolved = resolveChannelPermissions(
    base,
    ["member"],
    {
      otherRole: { allow: Permissions.SEND_MESSAGES, deny: 0 },
    },
    undefined,
  );

  assert.equal(resolved, base);
});
