import assert from "node:assert/strict";
import test from "node:test";

import { generateSnowflake } from "../src/utils/snowflake.ts";

const CUSTOM_EPOCH_MS = 1735689600000;

test("generateSnowflake increases when timestamp advances", () => {
  const originalNow = Date.now;
  let now = CUSTOM_EPOCH_MS + 1000;
  Date.now = () => now;

  try {
    const first = BigInt(generateSnowflake());
    now += 1;
    const second = BigInt(generateSnowflake());

    assert.ok(second > first);
  } finally {
    Date.now = originalNow;
  }
});

test("generateSnowflake increments sequence for same millisecond", () => {
  const originalNow = Date.now;
  Date.now = () => CUSTOM_EPOCH_MS + 2000;

  try {
    const first = BigInt(generateSnowflake());
    const second = BigInt(generateSnowflake());

    assert.ok(second > first);
  } finally {
    Date.now = originalNow;
  }
});

test("generateSnowflake waits for next millisecond on sequence overflow", () => {
  const originalNow = Date.now;
  let callCount = 0;

  Date.now = () => {
    callCount += 1;
    // Stay in the same millisecond long enough to overflow 12-bit sequence.
    if (callCount <= 4097) return CUSTOM_EPOCH_MS + 3000;
    return CUSTOM_EPOCH_MS + 3001;
  };

  try {
    for (let i = 0; i < 4096; i += 1) {
      generateSnowflake();
    }

    const overflowed = BigInt(generateSnowflake());
    assert.ok(overflowed > 0n);
    assert.ok(callCount > 4097);
  } finally {
    Date.now = originalNow;
  }
});
