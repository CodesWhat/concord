import assert from "node:assert/strict";
import test from "node:test";

import { getAvatarColor } from "../../src/utils/colors.ts";

test("getAvatarColor returns stable palette values for a user id", () => {
  const first = getAvatarColor("u1");
  const second = getAvatarColor("u1");

  assert.deepEqual(first, second);
  assert.deepEqual(first, { bg: "#FAA61A", text: "#1a1a2e" });
});

test("getAvatarColor always returns expected shape", () => {
  const color = getAvatarColor("some-user-id");

  assert.equal(typeof color.bg, "string");
  assert.equal(typeof color.text, "string");
  assert.ok(color.bg.length > 0);
  assert.ok(color.text.length > 0);
});
