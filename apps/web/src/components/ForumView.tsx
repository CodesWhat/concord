import { useEffect, useState, useRef, useCallback } from "react";
import { useForumStore } from "../stores/forumStore";
import ForumPostCard from "./ForumPostCard";
import ForumPostDetail from "./ForumPostDetail";
import CreatePostModal from "./CreatePostModal";
import EmptyState from "./EmptyState";

const SORT_OPTIONS = [
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
] as const;

export default function ForumView({ channelId }: { channelId: string }) {
  const posts = useForumStore((s) => s.posts);
  const selectedPost = useForumStore((s) => s.selectedPost);
  const sortBy = useForumStore((s) => s.sortBy);
  const isLoading = useForumStore((s) => s.isLoading);
  const hasMore = useForumStore((s) => s.hasMore);
  const fetchPosts = useForumStore((s) => s.fetchPosts);
  const loadMorePosts = useForumStore((s) => s.loadMorePosts);
  const setSortBy = useForumStore((s) => s.setSortBy);
  const reset = useForumStore((s) => s.reset);
  const [createOpen, setCreateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    reset();
    fetchPosts(channelId);
  }, [channelId, fetchPosts, reset]);

  const handleSortChange = (sort: "hot" | "new" | "top") => {
    setSortBy(sort);
    fetchPosts(channelId, sort);
  };

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isLoading || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      loadMorePosts(channelId);
    }
  }, [isLoading, hasMore, loadMorePosts, channelId]);

  if (selectedPost) {
    return <ForumPostDetail />;
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSortChange(opt.value)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                sortBy === opt.value
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-elevated"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          New Post
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin"
      >
        {isLoading && posts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="8" y1="8" x2="16" y2="8" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="8" y1="16" x2="12" y2="16" />
              </svg>
            }
            heading="No posts yet"
            subtext="Be the first to start a discussion!"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {posts.map((post) => (
              <ForumPostCard key={post.id} post={post} />
            ))}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        )}
      </div>

      <CreatePostModal
        channelId={channelId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
