import assert from "node:assert/strict";
import test from "node:test";

import { api } from "../../src/api/client.ts";
import {
  type ForumComment,
  type ForumPost,
  useForumStore,
} from "../../src/stores/forumStore.ts";

function makePost(id: string): ForumPost {
  return {
    id,
    channelId: "c1",
    authorId: "u1",
    title: `title-${id}`,
    content: `content-${id}`,
    upvotes: 1,
    downvotes: 0,
    score: 1,
    pinned: false,
    locked: false,
    commentCount: 0,
    tags: [],
    createdAt: "2026-02-20T00:00:00.000Z",
    author: {
      username: "user",
      displayName: "User",
      avatarUrl: null,
    },
    userVote: null,
  };
}

function makeComment(id: string): ForumComment {
  return {
    id,
    channelId: "c1",
    authorId: "u1",
    content: `comment-${id}`,
    replyToId: null,
    createdAt: "2026-02-20T00:00:00.000Z",
    author: {
      username: "user",
      displayName: "User",
      avatarUrl: null,
    },
  };
}

function resetForumState() {
  useForumStore.setState({
    posts: [],
    selectedPost: null,
    comments: [],
    sortBy: "hot",
    isLoading: false,
    hasMore: true,
  });
}

test("fetchPosts loads with explicit/default sort and handles failures", async () => {
  resetForumState();
  const originalGet = api.get;
  const calls: string[] = [];
  let callIndex = 0;
  (api as { get: typeof api.get }).get = (async (path) => {
    calls.push(path);
    callIndex += 1;
    if (callIndex === 1) return Array.from({ length: 25 }, (_, i) => makePost(`p${i}`));
    if (callIndex === 2) return [makePost("p-x")];
    throw new Error("fetch fail");
  }) as typeof api.get;

  try {
    await useForumStore.getState().fetchPosts("c1", "new");
    assert.equal(useForumStore.getState().posts.length, 25);
    assert.equal(useForumStore.getState().hasMore, true);

    useForumStore.setState({ sortBy: "top" });
    await useForumStore.getState().fetchPosts("c1");
    assert.equal(useForumStore.getState().posts.length, 1);
    assert.equal(useForumStore.getState().hasMore, false);

    await useForumStore.getState().fetchPosts("c1");
    assert.equal(useForumStore.getState().isLoading, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }

  assert.equal(calls[0]?.includes("sort=new"), true);
  assert.equal(calls[1]?.includes("sort=top"), true);
});

test("loadMorePosts handles guards, success, and failures", async () => {
  resetForumState();
  const originalGet = api.get;
  let calls = 0;
  (api as { get: typeof api.get }).get = (async () => {
    calls += 1;
    if (calls === 1) return [makePost("p2")];
    throw new Error("load more fail");
  }) as typeof api.get;

  try {
    useForumStore.setState({ hasMore: false, posts: [makePost("p1")] });
    await useForumStore.getState().loadMorePosts("c1");
    assert.equal(calls, 0);

    useForumStore.setState({ hasMore: true, isLoading: true, posts: [makePost("p1")] });
    await useForumStore.getState().loadMorePosts("c1");
    assert.equal(calls, 0);

    useForumStore.setState({ hasMore: true, isLoading: false, posts: [] });
    await useForumStore.getState().loadMorePosts("c1");
    assert.equal(calls, 0);

    useForumStore.setState({
      posts: [undefined as unknown as ForumPost],
      hasMore: true,
      isLoading: false,
    });
    await useForumStore.getState().loadMorePosts("c1");
    assert.equal(calls, 0);

    useForumStore.setState({
      posts: [makePost("p1")],
      hasMore: true,
      isLoading: false,
      sortBy: "hot",
    });
    await useForumStore.getState().loadMorePosts("c1");
    assert.equal(calls, 1);
    assert.equal(useForumStore.getState().posts.length, 2);

    await useForumStore.getState().loadMorePosts("c1");
    assert.equal(useForumStore.getState().isLoading, false);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
  }
});

test("createPost returns post on success and null on failure", async () => {
  resetForumState();
  const originalPost = api.post;
  (api as { post: typeof api.post }).post = (async () => makePost("p1")) as typeof api.post;

  try {
    const created = await useForumStore
      .getState()
      .createPost("c1", "title", "content", ["tag"]);
    assert.equal(created?.id, "p1");
    assert.equal(useForumStore.getState().posts[0]?.id, "p1");

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("create fail");
    }) as typeof api.post;
    const failed = await useForumStore
      .getState()
      .createPost("c1", "title", "content");
    assert.equal(failed, null);
  } finally {
    (api as { post: typeof api.post }).post = originalPost;
  }
});

test("comments and vote flows update related post state", async () => {
  resetForumState();
  const originalGet = api.get;
  const originalPost = api.post;

  useForumStore.setState({
    posts: [makePost("p1"), makePost("p2")],
    selectedPost: makePost("p1"),
  });

  let postCall = 0;
  (api as { get: typeof api.get }).get = (async () => [makeComment("c1")]) as typeof api.get;
  (api as { post: typeof api.post }).post = (async (path) => {
    postCall += 1;
    if (path.includes("/comments")) return makeComment("c2");
    return { upvotes: 5, downvotes: 1, score: 4, userVote: 1 };
  }) as typeof api.post;

  try {
    await useForumStore.getState().fetchComments("p1");
    assert.equal(useForumStore.getState().comments.length, 1);

    await useForumStore.getState().createComment("p1", "reply");
    assert.equal(useForumStore.getState().comments.length, 2);
    assert.equal(useForumStore.getState().selectedPost?.commentCount, 1);
    assert.equal(useForumStore.getState().posts[0]?.commentCount, 1);

    await useForumStore.getState().vote("p1", 1);
    assert.equal(useForumStore.getState().selectedPost?.score, 4);
    assert.equal(useForumStore.getState().posts[0]?.upvotes, 5);
    assert.equal(postCall, 2);

    (api as { get: typeof api.get }).get = (async () => {
      throw new Error("comments fail");
    }) as typeof api.get;
    await useForumStore.getState().fetchComments("p1");
    assert.deepEqual(useForumStore.getState().comments, []);

    (api as { post: typeof api.post }).post = (async () => {
      throw new Error("post fail");
    }) as typeof api.post;
    await useForumStore.getState().createComment("p1", "reply");
    await useForumStore.getState().vote("p1", 1);
  } finally {
    (api as { get: typeof api.get }).get = originalGet;
    (api as { post: typeof api.post }).post = originalPost;
  }
});

test("selectPost, setSortBy, and reset update state", () => {
  resetForumState();
  useForumStore.setState({
    posts: [makePost("p1")],
    comments: [makeComment("c1")],
  });

  useForumStore.getState().selectPost(makePost("p1"));
  assert.equal(useForumStore.getState().selectedPost?.id, "p1");
  assert.deepEqual(useForumStore.getState().comments, []);

  useForumStore.getState().setSortBy("new");
  assert.equal(useForumStore.getState().sortBy, "new");

  useForumStore.getState().reset();
  assert.deepEqual(useForumStore.getState().posts, []);
  assert.equal(useForumStore.getState().selectedPost, null);
  assert.equal(useForumStore.getState().sortBy, "hot");
});
