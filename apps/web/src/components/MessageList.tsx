import { useRef, useCallback } from "react";
import { useMessageStore, type Message } from "../stores/messageStore";
import { useChannelStore } from "../stores/channelStore";

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isGrouped(current: Message, prev: Message | undefined): boolean {
  if (!prev) return false;
  if (prev.authorId !== current.authorId) return false;
  const diff = new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return diff < 5 * 60 * 1000;
}

function MessageActionBar() {
  return (
    <div className="absolute -top-4 right-2 hidden gap-0.5 rounded-md border border-border bg-bg-elevated px-1 py-0.5 shadow-lg group-hover:flex">
      <ActionBtn title="Reply"><ReplyIcon /></ActionBtn>
      <ActionBtn title="React"><EmojiIcon /></ActionBtn>
      <ActionBtn title="More"><MoreIcon /></ActionBtn>
    </div>
  );
}

function ActionBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-bg-content hover:text-text-secondary"
    >
      {children}
    </button>
  );
}

function renderContent(text: string) {
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    const lang = (lines[0] ?? "").replace("```", "");
    const code = lines.slice(1, -1).join("\n");
    return (
      <pre className="mt-1 overflow-x-auto rounded-md bg-bg-deepest px-3 py-2 font-mono text-xs text-text-secondary">
        {lang && <div className="mb-1 text-xs text-text-muted">{lang}</div>}
        <code>{code}</code>
      </pre>
    );
  }

  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function MessageRow({
  message,
  grouped,
}: {
  message: Message;
  grouped: boolean;
}) {
  const authorName = message.author?.displayName ?? "Unknown";
  const initial = authorName.charAt(0);

  if (grouped) {
    return (
      <div className="group relative flex items-start px-4 py-0.5 hover:bg-bg-elevated/50">
        <div className="w-10 shrink-0 mr-4" />
        <div className="text-sm leading-relaxed text-text-primary">
          {renderContent(message.content)}
        </div>
        <MessageActionBar />
      </div>
    );
  }

  return (
    <div className="group relative flex items-start px-4 py-2 hover:bg-bg-elevated/50">
      <div className="mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white bg-primary/30">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {authorName}
          </span>
          <span className="text-xs text-text-muted">{formatTime(message.createdAt)}</span>
        </div>
        <div className="text-sm leading-relaxed text-text-primary">
          {renderContent(message.content)}
        </div>
      </div>
      <MessageActionBar />
    </div>
  );
}

export default function MessageList() {
  const messages = useMessageStore((s) => s.messages);
  const isLoading = useMessageStore((s) => s.isLoading);
  const hasMore = useMessageStore((s) => s.hasMore);
  const loadMoreMessages = useMessageStore((s) => s.loadMoreMessages);
  const selectedChannelId = useChannelStore((s) => s.selectedChannelId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !selectedChannelId) return;
    if (el.scrollTop < 100 && hasMore && !isLoading) {
      loadMoreMessages(selectedChannelId);
    }
  }, [selectedChannelId, hasMore, isLoading, loadMoreMessages]);

  if (!selectedChannelId) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Select a channel to start chatting
      </div>
    );
  }

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto scrollbar-thin"
    >
      <div className="flex flex-col py-4">
        {messages.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            No messages yet. Start the conversation!
          </p>
        )}
        {messages.map((msg, i) => {
          const prev = i > 0 ? messages[i - 1] : undefined;
          const grouped = isGrouped(msg, prev);
          return <MessageRow key={msg.id} message={msg} grouped={grouped} />;
        })}
      </div>
    </div>
  );
}

// SVG icons
function ReplyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="1.5" /><circle cx="6" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" />
    </svg>
  );
}
