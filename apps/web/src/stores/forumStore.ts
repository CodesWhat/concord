import { create } from "zustand";
import { api } from "../api/client.js";

interface ForumPostAuthor {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ForumPost {
  id: string;
  channelId: string;
  authorId: string;
  title: string;
  content: string;
  upvotes: number;
  downvotes: number;
  score: number;
  pinned: boolean;
  locked: boolean;
  commentCount: number;
  tags: string[];
  createdAt: string;
  author: ForumPostAuthor;
  userVote?: number | null;
}

export interface ForumComment {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  replyToId: string | null;
  createdAt: string;
  author: ForumPostAuthor;
}

interface ForumState {
  posts: ForumPost[];
  selectedPost: ForumPost | null;
  comments: ForumComment[];
  sortBy: "hot" | "new" | "top";
  isLoading: boolean;
  hasMore: boolean;
  fetchPosts: (channelId: string, sort?: string) => Promise<void>;
  loadMorePosts: (channelId: string) => Promise<void>;
  createPost: (channelId: string, title: string, content: string, tags?: string[]) => Promise<ForumPost | null>;
  selectPost: (post: ForumPost | null) => void;
  fetchComments: (postId: string) => Promise<void>;
  createComment: (postId: string, content: string) => Promise<void>;
  vote: (postId: string, value: number) => Promise<void>;
  setSortBy: (sort: "hot" | "new" | "top") => void;
  reset: () => void;
}

export const useForumStore = create<ForumState>((set, get) => ({
  posts: [],
  selectedPost: null,
  comments: [],
  sortBy: "hot",
  isLoading: false,
  hasMore: true,

  fetchPosts: async (channelId: string, sort?: string) => {
    const sortBy = sort ?? get().sortBy;
    set({ isLoading: true, posts: [], hasMore: true });
    try {
      const posts = await api.get<ForumPost[]>(
        `/api/v1/channels/${channelId}/posts?sort=${sortBy}&limit=25`,
      );
      set({ posts, isLoading: false, hasMore: posts.length >= 25 });
    } catch {
      set({ isLoading: false });
    }
  },

  loadMorePosts: async (channelId: string) => {
    const { posts, hasMore, isLoading } = get();
    if (!hasMore || isLoading || posts.length === 0) return;

    const lastId = posts[posts.length - 1]?.id;
    if (!lastId) return;

    set({ isLoading: true });
    try {
      const more = await api.get<ForumPost[]>(
        `/api/v1/channels/${channelId}/posts?sort=${get().sortBy}&before=${lastId}&limit=25`,
      );
      set({
        posts: [...get().posts, ...more],
        isLoading: false,
        hasMore: more.length >= 25,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  createPost: async (channelId: string, title: string, content: string, tags?: string[]) => {
    try {
      const post = await api.post<ForumPost>(
        `/api/v1/channels/${channelId}/posts`,
        { title, content, tags },
      );
      set((s) => ({ posts: [post, ...s.posts] }));
      return post;
    } catch {
      return null;
    }
  },

  selectPost: (post: ForumPost | null) => {
    set({ selectedPost: post, comments: [] });
  },

  fetchComments: async (postId: string) => {
    try {
      const comments = await api.get<ForumComment[]>(
        `/api/v1/posts/${postId}/comments?limit=25`,
      );
      set({ comments });
    } catch {
      set({ comments: [] });
    }
  },

  createComment: async (postId: string, content: string) => {
    try {
      const comment = await api.post<ForumComment>(
        `/api/v1/posts/${postId}/comments`,
        { content },
      );
      set((s) => ({
        comments: [...s.comments, comment],
        selectedPost:
          s.selectedPost?.id === postId
            ? { ...s.selectedPost, commentCount: s.selectedPost.commentCount + 1 }
            : s.selectedPost,
        posts: s.posts.map((p) =>
          p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p,
        ),
      }));
    } catch {
      // ignore
    }
  },

  vote: async (postId: string, value: number) => {
    try {
      const result = await api.post<{ upvotes: number; downvotes: number; score: number; userVote: number | null }>(
        `/api/v1/posts/${postId}/vote`,
        { value },
      );
      const update = (post: ForumPost): ForumPost => ({
        ...post,
        upvotes: result.upvotes,
        downvotes: result.downvotes,
        score: result.score,
        userVote: result.userVote,
      });
      set((s) => ({
        posts: s.posts.map((p) => (p.id === postId ? update(p) : p)),
        selectedPost: s.selectedPost?.id === postId ? update(s.selectedPost) : s.selectedPost,
      }));
    } catch {
      // ignore
    }
  },

  setSortBy: (sort: "hot" | "new" | "top") => {
    set({ sortBy: sort });
  },

  reset: () => {
    set({
      posts: [],
      selectedPost: null,
      comments: [],
      sortBy: "hot",
      isLoading: false,
      hasMore: true,
    });
  },
}));
