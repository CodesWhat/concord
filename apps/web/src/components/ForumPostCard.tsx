import type { ForumPost } from "../stores/forumStore";
import { useForumStore } from "../stores/forumStore";
import { getAvatarColor } from "../utils/colors.js";
import { formatRelativeTime } from "../utils/formatRelative.js";

function VoteButtons({ post }: { post: ForumPost }) {
  const vote = useForumStore((s) => s.vote);

  const handleUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    vote(post.id, post.userVote === 1 ? 0 : 1);
  };

  const handleDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    vote(post.id, post.userVote === -1 ? 0 : -1);
  };

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[36px]">
      <button
        onClick={handleUp}
        className={`p-0.5 rounded transition-colors ${
          post.userVote === 1
            ? "text-orange-400"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <span className="text-sm font-semibold text-text-primary">{post.score}</span>
      <button
        onClick={handleDown}
        className={`p-0.5 rounded transition-colors ${
          post.userVote === -1
            ? "text-blue-400"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\[.*?\]\(.+?\)/g, "")
    .replace(/>\s/g, "")
    .replace(/\n/g, " ")
    .trim();
}

export default function ForumPostCard({ post }: { post: ForumPost }) {
  const selectPost = useForumStore((s) => s.selectPost);
  const avatar = getAvatarColor(post.authorId);

  return (
    <div
      onClick={() => selectPost(post)}
      className={`flex gap-3 rounded-lg p-3 cursor-pointer transition-colors border ${
        post.pinned
          ? "bg-primary/5 border-l-2 border-primary"
          : "bg-bg-sidebar border-border/50 hover:bg-bg-elevated"
      }`}
    >
      <VoteButtons post={post} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {post.pinned && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-primary shrink-0">
              <path d="M16 2l5 5-4 4 3 6-4 4-6-3-4 4-2-2 4-4-3-6 4-4 6 3z" />
            </svg>
          )}
          {post.locked && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
          <h3 className="text-base font-semibold text-text-primary line-clamp-2">{post.title}</h3>
        </div>
        {post.content && (
          <p className="mt-0.5 text-sm text-text-secondary line-clamp-2">
            {stripMarkdown(post.content)}
          </p>
        )}
        {post.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-primary/20 text-primary text-xs px-2 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold shrink-0"
            style={{ backgroundColor: avatar.bg, color: avatar.text }}
          >
            {post.author.displayName?.charAt(0) ?? "?"}
          </div>
          <span className="text-text-secondary">{post.author.displayName}</span>
          <span>{formatRelativeTime(post.createdAt)}</span>
          <span className="flex items-center gap-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {post.commentCount}
          </span>
        </div>
      </div>
    </div>
  );
}
