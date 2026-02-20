import assert from "node:assert/strict";
import test from "node:test";

import { formatTime } from "../../src/utils/format.ts";
import { formatRelativeTime } from "../../src/utils/formatRelative.ts";

test("formatTime returns a time-like string", () => {
  const formatted = formatTime("2026-02-20T12:34:00.000Z");
  assert.match(formatted, /\d{1,2}:\d{2}/);
});

test("formatRelativeTime covers each range", () => {
  const originalNow = Date.now;
  Date.now = () => new Date("2026-02-20T00:00:00.000Z").getTime();

  try {
    assert.equal(
      formatRelativeTime("2026-02-19T23:59:31.000Z"),
      "just now",
    );
    assert.equal(formatRelativeTime("2026-02-19T23:59:00.000Z"), "1m ago");
    assert.equal(formatRelativeTime("2026-02-19T23:00:00.000Z"), "1h ago");
    assert.equal(formatRelativeTime("2026-02-18T00:00:00.000Z"), "2d ago");
    assert.equal(formatRelativeTime("2025-12-01T00:00:00.000Z"), "2mo ago");
    assert.equal(formatRelativeTime("2023-12-01T00:00:00.000Z"), "2y ago");
  } finally {
    Date.now = originalNow;
  }
});
