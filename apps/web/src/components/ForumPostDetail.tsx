import { useState, useEffect, useRef } from "react";
import { useForumStore } from "../stores/forumStore";
import type { ForumPost, ForumComment } from "../stores/forumStore";
import Markdown from "./Markdown";
import { getAvatarColor } from "../utils/colors.js";
import { formatRelativeTime } from "../utils/formatRelative.js";

function VoteRow({ post }: { post: ForumPost }) {
  const vote = useForumStore((s) => s.vote);

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={() => vote(post.id, post.userVote === 1 ? 0 : 1)}
        className={`p-1 rounded transition-colors ${
          post.userVote === 1
            ? "text-orange-400"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <span className="text-base font-semibold text-text-primary">{post.score}</span>
      <button
        onClick={() => vote(post.id, post.userVote === -1 ? 0 : -1)}
        className={`p-1 rounded transition-colors ${
          post.userVote === -1
            ? "text-blue-400"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}

function CommentItem({ comment }: { comment: ForumComment }) {
  const avatar = getAvatarColor(comment.authorId);

  return (
    <div className="flex gap-3 py-3">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0"
        style={{ backgroundColor: avatar.bg, color: avatar.text }}
      >
        {comment.author.displayName?.charAt(0) ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-text-primary">{comment.author.displayName}</span>
          <span className="text-text-muted">{formatRelativeTime(comment.createdAt)}</span>
        </div>
        <div className="mt-0.5 text-sm text-text-secondary">
          <Markdown content={comment.content} />
        </div>
      </div>
    </div>
  );
}

function CommentInput({ postId }: { postId: string }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createComment = useForumStore((s) => s.createComment);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    await createComment(postId, content.trim());
    setContent("");
    setSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2 pt-3">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write a comment..."
        rows={2}
        className="flex-1 rounded-md bg-bg-deepest px-3 py-2 text-sm text-text-primary placeholder-text-muted border border-border focus:border-primary focus:outline-none resize-none"
      />
      <button
        onClick={handleSubmit}
        disabled={!content.trim() || submitting}
        className="self-end rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "..." : "Reply"}
      </button>
    </div>
  );
}

export default function ForumPostDetail() {
  const post = useForumStore((s) => s.selectedPost);
  const comments = useForumStore((s) => s.comments);
  const selectPost = useForumStore((s) => s.selectPost);
  const fetchComments = useForumStore((s) => s.fetchComments);

  useEffect(() => {
    if (post) {
      fetchComments(post.id);
    }
  }, [post?.id, fetchComments]);

  if (!post) return null;

  const avatar = getAvatarColor(post.authorId);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
      <button
        onClick={() => selectPost(null)}
        className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to posts
      </button>

      <div className="flex items-start gap-2">
        {post.pinned && (
          <span className="rounded bg-primary/20 text-primary text-xs px-2 py-0.5 font-medium mt-1">Pinned</span>
        )}
        {post.locked && (
          <span className="rounded bg-text-muted/20 text-text-muted text-xs px-2 py-0.5 font-medium mt-1">Locked</span>
        )}
      </div>

      <h1 className="text-xl font-bold text-text-primary mt-2">{post.title}</h1>

      <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
          style={{ backgroundColor: avatar.bg, color: avatar.text }}
        >
          {post.author.displayName?.charAt(0) ?? "?"}
        </div>
        <span className="text-text-secondary">{post.author.displayName}</span>
        <span>{formatRelativeTime(post.createdAt)}</span>
      </div>

      {post.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {post.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-primary/20 text-primary text-xs px-2 py-0.5">
              {tag}
            </span>
          ))}
        </div>
      )}

      <VoteRow post={post} />

      <div className="mt-4 text-sm text-text-secondary">
        <Markdown content={post.content} />
      </div>

      <div className="my-4 h-px bg-border" />

      <h2 className="text-sm font-semibold text-text-primary mb-2">
        {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
      </h2>

      <div className="divide-y divide-border/50">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {comments.length === 0 && (
        <p className="text-sm text-text-muted py-4">No comments yet. Be the first to reply!</p>
      )}

      {post.locked ? (
        <div className="mt-4 rounded-md bg-bg-elevated px-4 py-3 text-sm text-text-muted flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          This post is locked -- no new comments
        </div>
      ) : (
        <CommentInput postId={post.id} />
      )}
    </div>
  );
}
