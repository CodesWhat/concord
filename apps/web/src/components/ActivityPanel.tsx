import { useCallback } from "react";
import { useActivityStore } from "../stores/activityStore.js";
import type { ActivityItem } from "../stores/activityStore.js";
import { useChannelStore } from "../stores/channelStore.js";
import { useMessageStore } from "../stores/messageStore.js";

const FILTERS = ["all", "mentions", "replies", "reactions"] as const;

export default function ActivityPanel() {
  const { isOpen, items, isLoading, hasMore, filter, close, setFilter, loadMore } =
    useActivityStore();
  const selectChannel = useChannelStore((s) => s.selectChannel);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);

  const handleItemClick = useCallback(
    (item: ActivityItem) => {
      selectChannel(item.channelId);
      fetchMessages(item.channelId);
      close();
    },
    [selectChannel, fetchMessages, close],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 animate-fade-in"
      onClick={close}
    >
      <div
        className="relative flex h-full w-full max-w-md flex-col bg-bg-sidebar shadow-2xl animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <InboxIcon />
            <span className="text-sm font-semibold text-text-primary">
              Inbox
            </span>
          </div>
          <button
            onClick={close}
            className="text-text-muted hover:text-text-secondary transition-colors"
            title="Close inbox"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-border px-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "text-primary border-b-2 border-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && items.length === 0 && (
            <div className="flex items-center justify-center py-12 text-text-muted text-sm gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading...
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
              <InboxEmptyIcon />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs">
                Mentions, replies, and reactions will show up here
              </p>
            </div>
          )}

          {items.length > 0 && (
            <ul>
              {items.map((item, i) => (
                <li key={`${item.type}-${item.messageId}-${i}`}>
                  <button
                    onClick={() => handleItemClick(item)}
                    className="w-full text-left px-4 py-3 hover:bg-bg-content transition-colors border-b border-border last:border-0 focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
                  >
                    {/* Type badge + channel + timestamp */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <TypeBadge type={item.type} emoji={item.emoji} />
                      <span className="text-xs text-text-muted">
                        #{item.channelName}
                      </span>
                      <span className="text-xs text-text-muted">·</span>
                      <span className="text-xs text-text-muted">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Author */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar
                        src={item.author.avatarUrl}
                        name={
                          item.author.displayName || item.author.username
                        }
                      />
                      <span className="text-xs font-medium text-text-secondary">
                        {item.author.displayName || item.author.username}
                      </span>
                    </div>

                    {/* Content preview */}
                    <p className="text-sm text-text-secondary line-clamp-2">
                      {item.content}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && !isLoading && (
          <div className="border-t border-border px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
            {hasMore && (
              <button
                onClick={loadMore}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function TypeBadge({
  type,
  emoji,
}: {
  type: ActivityItem["type"];
  emoji?: string;
}) {
  if (type === "mention") {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary">
        @
      </span>
    );
  }
  if (type === "reply") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-text-muted"
      >
        <polyline points="9 17 4 12 9 7" />
        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
      </svg>
    );
  }
  // reaction
  return <span className="text-xs">{emoji || "?"}</span>;
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-5 w-5 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)
    return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Icons ────────────────────────────────────────────────────────────

function InboxIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="text-text-primary"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function InboxEmptyIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="text-text-muted"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
