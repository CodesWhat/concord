import assert from "node:assert/strict";
import test from "node:test";

import { usePresenceStore } from "../../src/stores/presenceStore.ts";

test("presence store updates and reads user status", () => {
  usePresenceStore.setState({ statuses: {} });

  const initial = usePresenceStore.getState().getStatus("user-1");
  assert.equal(initial, "offline");

  usePresenceStore.getState().updatePresence("user-1", "online");
  const updated = usePresenceStore.getState().getStatus("user-1");
  assert.equal(updated, "online");
});
