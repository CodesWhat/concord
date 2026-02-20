import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import { useChannelStore } from "../../src/stores/channelStore.ts";

function resetChannelState() {
  useChannelStore.setState({
    channels: [],
    categories: [],
    selectedChannelId: null,
  });
}

test("fetchChannels flattens groups into channels and categories", async () => {
  resetChannelState();
  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async () => [
    {
      category: { id: "cat1", name: "General", position: 1 },
      channels: [
        {
          id: "c1",
          serverId: "s1",
          categoryId: "cat1",
          type: "text",
          name: "general",
          topic: null,
          position: 1,
        },
      ],
    },
    {
      category: null,
      channels: [
        {
          id: "c2",
          serverId: "s1",
          categoryId: null,
          type: "voice",
          name: "lounge",
          topic: null,
          position: 2,
        },
      ],
    },
  ]) as typeof api.get;

  try {
    await useChannelStore.getState().fetchChannels("s1");
    assert.equal(useChannelStore.getState().channels.length, 2);
    assert.equal(useChannelStore.getState().categories.length, 1);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("fetchChannels clears state on API failure", async () => {
  resetChannelState();
  useChannelStore.setState({
    channels: [{ id: "c1" } as never],
    categories: [{ id: "cat1" } as never],
  });
  const originalGet = api.get;
  (api as { get: typeof api.get }).get = (async () => {
    throw new Error("fetch fail");
  }) as typeof api.get;

  try {
    await useChannelStore.getState().fetchChannels("s1");
    assert.deepEqual(useChannelStore.getState().channels, []);
    assert.deepEqual(useChannelStore.getState().categories, []);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("selectChannel and getSelectedChannel return selected entry", () => {
  resetChannelState();
  useChannelStore.setState({
    channels: [
      {
        id: "c1",
        serverId: "s1",
        categoryId: null,
        type: "text",
        name: "general",
        topic: null,
        position: 1,
      },
    ],
  });

  assert.equal(useChannelStore.getState().getSelectedChannel(), undefined);
  useChannelStore.getState().selectChannel("c1");
  assert.equal(useChannelStore.getState().getSelectedChannel()?.id, "c1");
});
