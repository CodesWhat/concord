import { useState, useRef, useEffect } from "react";
import { useForumStore } from "../stores/forumStore";

interface CreatePostModalProps {
  channelId: string;
  open: boolean;
  onClose: () => void;
}

export default function CreatePostModal({ channelId, open, onClose }: CreatePostModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const createPost = useForumStore((s) => s.createPost);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setContent("");
      setTagInput("");
      setTags([]);
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,/g, "");
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    const post = await createPost(channelId, title.trim(), content.trim(), tags.length > 0 ? tags : undefined);
    setSubmitting(false);
    if (post) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-bg-sidebar p-6 shadow-xl border border-border animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary mb-4">Create Post</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Title</label>
            <div className="relative">
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 300))}
                placeholder="Post title"
                className="w-full rounded-md bg-bg-deepest px-3 py-2 text-sm text-text-primary placeholder-text-muted border border-border focus:border-primary focus:outline-none"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                {title.length}/300
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post (Markdown supported)"
              rows={8}
              className="w-full rounded-md bg-bg-deepest px-3 py-2 text-sm text-text-primary placeholder-text-muted border border-border focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">Tags</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Type a tag and press Enter"
              className="w-full rounded-md bg-bg-deepest px-3 py-2 text-sm text-text-primary placeholder-text-muted border border-border focus:border-primary focus:outline-none"
            />
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-primary/20 text-primary text-xs px-2 py-0.5">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-text-primary">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
