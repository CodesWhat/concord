import assert from "node:assert/strict";
import test from "node:test";

import { useTypingStore } from "../../src/stores/typingStore.ts";

function withMockTimers(
  run: (ctx: {
    callbacks: Map<number, () => void>;
    cleared: number[];
  }) => void,
) {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let nextId = 1;
  const callbacks = new Map<number, () => void>();
  const cleared: number[] = [];

  globalThis.setTimeout = ((callback: TimerHandler) => {
    const id = nextId++;
    callbacks.set(id, callback as () => void);
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
    const numericId = id as unknown as number;
    cleared.push(numericId);
    callbacks.delete(numericId);
  }) as typeof clearTimeout;

  try {
    run({ callbacks, cleared });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

test("typing store tracks and returns typing users", () => {
  withMockTimers(() => {
    useTypingStore.setState({ typing: {} });

    useTypingStore.getState().addTyping("channel-1", "user-1");
    useTypingStore.getState().addTyping("channel-1", "user-2");

    assert.deepEqual(useTypingStore.getState().getTypingUsers("channel-1"), [
      "user-1",
      "user-2",
    ]);
    assert.deepEqual(useTypingStore.getState().getTypingUsers("missing"), []);
  });
});

test("addTyping replaces existing timer and auto-expires typing state", () => {
  withMockTimers(({ callbacks, cleared }) => {
    useTypingStore.setState({ typing: {} });

    useTypingStore.getState().addTyping("channel-1", "user-1");
    useTypingStore.getState().addTyping("channel-1", "user-1");
    assert.ok(cleared.length >= 1);

    const callback = callbacks.values().next().value;
    assert.ok(callback);
    callback?.();

    assert.deepEqual(useTypingStore.getState().getTypingUsers("channel-1"), []);
  });
});

test("removeTyping handles unknown channels and preserves remaining users", () => {
  withMockTimers(() => {
    useTypingStore.setState({ typing: {} });

    useTypingStore.getState().removeTyping("unknown", "u");
    assert.deepEqual(useTypingStore.getState().typing, {});

    useTypingStore.getState().addTyping("channel-1", "user-1");
    useTypingStore.getState().addTyping("channel-1", "user-2");
    useTypingStore.getState().removeTyping("channel-1", "user-1");

    assert.deepEqual(useTypingStore.getState().getTypingUsers("channel-1"), [
      "user-2",
    ]);
  });
});
