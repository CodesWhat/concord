import { useState, useMemo, useRef, useEffect } from "react";
import { useThreadStore, type ThreadMessage } from "../stores/threadStore.js";
import Markdown from "./Markdown.js";
import { getAvatarColor } from "../utils/colors.js";
import { formatTime } from "../utils/format.js";
import EmptyState from "./EmptyState.js";

// ---------- Tree Building ----------

interface TreeNode {
  message: ThreadMessage;
  children: TreeNode[];
  depth: number;
}

function buildTree(messages: ThreadMessage[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const msg of messages) {
    byId.set(msg.id, { message: msg, children: [], depth: 0 });
  }

  for (const msg of messages) {
    const node = byId.get(msg.id)!;
    if (msg.replyToId && byId.has(msg.replyToId)) {
      const parent = byId.get(msg.replyToId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function flattenTree(nodes: TreeNode[]): { message: ThreadMessage; depth: number }[] {
  const result: { message: ThreadMessage; depth: number }[] = [];
  function walk(list: TreeNode[]) {
    for (const node of list) {
      result.push({ message: node.message, depth: node.depth });
      walk(node.children);
    }
  }
  walk(nodes);
  return result;
}

// ---------- Thread Message Row ----------

function ThreadMessageRow({
  message,
  depth,
  onReply,
}: {
  message: ThreadMessage;
  depth: number;
  onReply: (messageId: string) => void;
}) {
  const authorName = message.author?.displayName ?? "Unknown";
  const initial = authorName.charAt(0);
  const indent = Math.min(depth, 10) * 16;

  return (
    <div
      className="group relative flex items-start px-3 py-1.5 hover:bg-bg-elevated/50"
      style={{ paddingLeft: `${12 + indent}px` }}
    >
      <div
        className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{ backgroundColor: getAvatarColor(message.authorId).bg, color: getAvatarColor(message.authorId).text }}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-text-primary">
            {authorName}
          </span>
          <span className="text-[10px] text-text-muted">
            {formatTime(message.createdAt)}
          </span>
        </div>
        <div className="text-sm leading-relaxed text-text-primary">
          <Markdown content={message.content} />
        </div>
      </div>
      <button
        onClick={() => onReply(message.id)}
        title="Reply"
        className="absolute -top-2 right-2 hidden h-6 w-6 items-center justify-center rounded border border-border bg-bg-elevated text-text-muted shadow-sm hover:text-text-secondary group-hover:flex focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
      >
        <ReplyIcon />
      </button>
    </div>
  );
}

// ---------- Thread Panel ----------

export default function ThreadPanel() {
  const activeThreadId = useThreadStore((s) => s.activeThreadId);
  const threads = useThreadStore((s) => s.threads);
  const threadMessages = useThreadStore((s) => s.threadMessages);
  const isLoading = useThreadStore((s) => s.isLoading);
  const closeThread = useThreadStore((s) => s.closeThread);
  const sendThreadMessage = useThreadStore((s) => s.sendThreadMessage);

  const [input, setInput] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const thread = threads.find((t) => t.id === activeThreadId);

  const flatMessages = useMemo(() => {
    const tree = buildTree(threadMessages);
    return flattenTree(tree);
  }, [threadMessages]);

  // Find the message being replied to for the indicator
  const replyToMessage = replyToId
    ? threadMessages.find((m) => m.id === replyToId)
    : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [flatMessages.length]);

  if (!activeThreadId) return null;

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendThreadMessage(activeThreadId, trimmed, replyToId ?? undefined);
    setInput("");
    setReplyToId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && replyToId) {
      setReplyToId(null);
    }
  };

  return (
    <div className="flex w-96 shrink-0 flex-col border-l border-border bg-bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary truncate">
          Thread: {thread?.name ?? "Thread"}
        </h3>
        <button
          onClick={closeThread}
          className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-bg-elevated hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
          title="Close thread"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : flatMessages.length === 0 ? (
          <EmptyState
            icon={<ThreadEmptyIcon />}
            heading="No replies yet"
            subtext="Start the conversation!"
          />
        ) : (
          <div className="flex flex-col py-2">
            {flatMessages.map(({ message, depth }) => (
              <ThreadMessageRow
                key={message.id}
                message={message}
                depth={depth}
                onReply={setReplyToId}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-border px-3 pb-3 pt-2">
        {replyToId && (
          <div className="mb-1.5 flex items-center justify-between rounded bg-bg-elevated px-2 py-1">
            <span className="truncate text-xs text-text-secondary">
              Replying to{" "}
              {replyToMessage?.author?.displayName ?? "message"}
            </span>
            <button
              onClick={() => setReplyToId(null)}
              className="ml-2 text-xs text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
            >
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply in thread..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-primary disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
            title="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Icons ----------

function ThreadEmptyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="10" x2="15" y2="10" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
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

function ReplyIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
