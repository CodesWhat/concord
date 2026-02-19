import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { useMessageStore, type Message } from "../stores/messageStore.js";
import { useChannelStore } from "../stores/channelStore.js";
import { useAuthStore } from "../stores/authStore.js";
import { useThreadStore, type Thread } from "../stores/threadStore.js";
import { useUnreadStore } from "../stores/unreadStore.js";
import { useReactionStore } from "../stores/reactionStore.js";
import ThreadIndicator from "./ThreadIndicator.js";
import AttachmentPreview from "./AttachmentPreview.js";
import EmptyState from "./EmptyState.js";
import Markdown from "./Markdown.js";
import CreateThreadModal from "./CreateThreadModal.js";
import UserProfileCard from "./UserProfileCard.js";
import ReactionBar from "./ReactionBar.js";
import EmojiPicker from "./EmojiPicker.js";
import { getAvatarColor } from "../utils/colors.js";
import { formatTime } from "../utils/format.js";

function isGrouped(current: Message, prev: Message | undefined): boolean {
  if (!prev) return false;
  if (prev.authorId !== current.authorId) return false;
  const diff = new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return diff < 5 * 60 * 1000;
}

// ---------- Action Bar ----------

function MessageActionBar({
  message,
  isOwnMessage,
  hasThread,
  onEdit,
  onDelete,
  onCreateThread,
  onReact,
}: {
  message: Message;
  isOwnMessage: boolean;
  hasThread: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCreateThread: () => void;
  onReact: () => void;
}) {
  return (
    <div className="absolute -top-4 right-2 hidden gap-0.5 rounded-md border border-border bg-bg-elevated px-1 py-0.5 shadow-lg group-hover:flex">
      <ActionBtn title="Add Reaction" onClick={onReact}><SmileActionIcon /></ActionBtn>
      <ActionBtn title="Reply"><ReplyIcon /></ActionBtn>
      {!hasThread && (
        <ActionBtn title="Create Thread" onClick={onCreateThread}><ThreadCreateIcon /></ActionBtn>
      )}
      {isOwnMessage && (
        <ActionBtn title="Edit" onClick={onEdit}><EditIcon /></ActionBtn>
      )}
      {isOwnMessage && (
        <ActionBtn title="Delete" onClick={onDelete}><DeleteIcon /></ActionBtn>
      )}
    </div>
  );
}

function ActionBtn({
  children,
  title,
  onClick,
  className: extraClass,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-bg-content hover:text-text-secondary focus-visible:ring-1 focus-visible:ring-primary/50 outline-none ${extraClass ?? ""}`}
    >
      {children}
    </button>
  );
}

// ---------- Delete Confirmation ----------

function DeleteConfirmation({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-3 rounded-md border border-border bg-bg-deepest px-3 py-2 animate-fade-in">
      <span className="text-sm text-text-secondary">
        Delete this message? This cannot be undone.
      </span>
      <button
        onClick={onConfirm}
        className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
      >
        Delete
      </button>
      <button
        onClick={onCancel}
        className="rounded-md bg-bg-elevated px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-content focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------- Inline Edit ----------

function InlineEdit({
  initialContent,
  onSave,
  onCancel,
}: {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialContent);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed && trimmed !== initialContent) {
        onSave(trimmed);
      } else if (trimmed === initialContent) {
        onCancel();
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="mt-1">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={Math.min(value.split("\n").length + 1, 8)}
        className="w-full resize-none rounded-md border border-border bg-bg-deepest px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
      />
      <div className="mt-1 flex items-center gap-2">
        <button
          onClick={() => {
            const trimmed = value.trim();
            if (trimmed && trimmed !== initialContent) {
              onSave(trimmed);
            } else {
              onCancel();
            }
          }}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-md bg-bg-elevated px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-content focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
        >
          Cancel
        </button>
        <span className="text-xs text-text-muted">
          Enter to save, Escape to cancel
        </span>
      </div>
    </div>
  );
}

// ---------- Message Row ----------

function MessageRow({
  message,
  grouped,
  thread,
  isNew,
  onAnimationEnd,
}: {
  message: Message;
  grouped: boolean;
  thread?: Thread;
  isNew?: boolean;
  onAnimationEnd?: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);
  const selectedChannelId = useChannelStore((s) => s.selectedChannelId);
  const editingMessageId = useMessageStore((s) => s.editingMessageId);
  const setEditingMessage = useMessageStore((s) => s.setEditingMessage);
  const editMessage = useMessageStore((s) => s.editMessage);
  const deleteMessage = useMessageStore((s) => s.deleteMessage);
  const openThread = useThreadStore((s) => s.openThread);
  const createThread = useThreadStore((s) => s.createThread);
  const reactionsByMessage = useReactionStore((s) => s.reactions);
  const addReaction = useReactionStore((s) => s.addReaction);
  const messageReactions = reactionsByMessage[message.id] ?? [];

  const [threadModalOpen, setThreadModalOpen] = useState(false);
  const [threadDefaultName, setThreadDefaultName] = useState("");
  const [profileAnchor, setProfileAnchor] = useState<DOMRect | null>(null);

  const isOwnMessage = userId === message.authorId;
  const isEditing = editingMessageId === message.id;
  const authorName = message.author?.displayName ?? "Unknown";
  const initial = authorName.charAt(0);

  const handleAuthorClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setProfileAnchor((prev) => prev ? null : rect);
  };

  const handleEdit = () => {
    setShowDeleteConfirm(false);
    setEditingMessage(message.id);
  };

  const handleDelete = () => {
    setEditingMessage(null);
    setShowDeleteConfirm(true);
  };

  const handleSaveEdit = (content: string) => {
    if (selectedChannelId) {
      editMessage(selectedChannelId, message.id, content);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleConfirmDelete = () => {
    if (selectedChannelId) {
      deleteMessage(selectedChannelId, message.id);
    }
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleCreateThread = () => {
    if (!selectedChannelId) return;
    setThreadDefaultName(message.content.slice(0, 50).trim() || "Thread");
    setThreadModalOpen(true);
  };

  const handleThreadCreate = async (name: string) => {
    if (!selectedChannelId) return;
    const created = await createThread(selectedChannelId, message.id, name);
    if (created) {
      openThread(created.id);
    }
  };

  const handleOpenThread = () => {
    if (thread) openThread(thread.id);
  };

  const handleReact = () => {
    setShowReactionPicker((prev) => !prev);
  };

  const handleEmojiSelect = (emoji: string) => {
    if (selectedChannelId) {
      addReaction(selectedChannelId, message.id, emoji);
    }
    setShowReactionPicker(false);
  };

  const editedTag = message.editedAt ? (
    <span className="ml-1 text-xs text-text-muted">(edited)</span>
  ) : null;

  const messageContent = isEditing ? (
    <InlineEdit
      initialContent={message.content}
      onSave={handleSaveEdit}
      onCancel={handleCancelEdit}
    />
  ) : (
    <>
      <Markdown content={message.content} />
      {editedTag}
    </>
  );

  const attachmentBlock = message.attachments && message.attachments.length > 0 ? (
    <div className="mt-1 flex flex-wrap gap-2">
      {message.attachments.map((att) => (
        <AttachmentPreview key={att.id} attachment={att} />
      ))}
    </div>
  ) : null;

  const threadIndicator = thread ? (
    <ThreadIndicator thread={thread} onClick={handleOpenThread} />
  ) : null;

  const threadModal = (
    <CreateThreadModal
      open={threadModalOpen}
      onClose={() => setThreadModalOpen(false)}
      defaultName={threadDefaultName}
      onCreate={handleThreadCreate}
    />
  );

  const rowRef = useRef<HTMLDivElement>(null);

  const reactionBar = selectedChannelId ? (
    <ReactionBar
      messageId={message.id}
      channelId={selectedChannelId}
      reactions={messageReactions}
    />
  ) : null;

  const inlineEmojiPicker = showReactionPicker && selectedChannelId ? (
    <EmojiPicker
      onSelect={handleEmojiSelect}
      onClose={() => setShowReactionPicker(false)}
      anchorRect={rowRef.current?.getBoundingClientRect() ?? new DOMRect(0, 400, 200, 20)}
    />
  ) : null;

  if (grouped) {
    return (
      <>
        <div
          ref={rowRef}
          className={`group relative flex items-start px-4 py-0.5 hover:bg-bg-elevated/50 ${isEditing ? "bg-bg-elevated/30" : ""} ${isNew ? "animate-slide-up" : ""}`}
          onAnimationEnd={onAnimationEnd}
        >
          <div className="w-10 shrink-0 mr-4" />
          <div className="min-w-0 flex-1 text-sm leading-relaxed text-text-primary">
            {messageContent}
            {attachmentBlock}
            {threadIndicator}
            {reactionBar}
            {inlineEmojiPicker}
            {showDeleteConfirm && (
              <DeleteConfirmation
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
              />
            )}
          </div>
          {!isEditing && !showDeleteConfirm && (
            <MessageActionBar
              message={message}
              isOwnMessage={isOwnMessage}
              hasThread={!!thread}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCreateThread={handleCreateThread}
              onReact={handleReact}
            />
          )}
        </div>
        {threadModal}
      </>
    );
  }

  return (
    <>
      <div
        ref={rowRef}
        className={`group relative flex items-start px-4 py-2 hover:bg-bg-elevated/50 ${isEditing ? "bg-bg-elevated/30" : ""} ${isNew ? "animate-slide-up" : ""}`}
        onAnimationEnd={onAnimationEnd}
      >
        <button
          onClick={handleAuthorClick}
          className="mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
          style={{ backgroundColor: getAvatarColor(message.authorId).bg, color: getAvatarColor(message.authorId).text }}
        >
          {initial}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <button onClick={handleAuthorClick} className="text-sm font-semibold text-text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/50 outline-none">
              {authorName}
            </button>
            <span className="text-xs text-text-secondary">{formatTime(message.createdAt)}</span>
          </div>
          <div className="text-sm leading-relaxed text-text-primary">
            {messageContent}
          </div>
          {attachmentBlock}
          {threadIndicator}
          {reactionBar}
          {inlineEmojiPicker}
          {showDeleteConfirm && (
            <DeleteConfirmation
              onConfirm={handleConfirmDelete}
              onCancel={handleCancelDelete}
            />
          )}
        </div>
        {!isEditing && !showDeleteConfirm && (
          <MessageActionBar
            message={message}
            isOwnMessage={isOwnMessage}
            hasThread={!!thread}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateThread={handleCreateThread}
            onReact={handleReact}
          />
        )}
      </div>
      {threadModal}
      {profileAnchor && (
        <UserProfileCard
          userId={message.authorId}
          anchorRect={profileAnchor}
          onClose={() => setProfileAnchor(null)}
        />
      )}
    </>
  );
}

// ---------- MessageList ----------

export default function MessageList() {
  const messages = useMessageStore((s) => s.messages);
  const isLoading = useMessageStore((s) => s.isLoading);
  const hasMore = useMessageStore((s) => s.hasMore);
  const loadMoreMessages = useMessageStore((s) => s.loadMoreMessages);
  const selectedChannelId = useChannelStore((s) => s.selectedChannelId);
  const newMessageIds = useMessageStore((s) => s.newMessageIds);
  const clearNewFlag = useMessageStore((s) => s.clearNewFlag);
  const threads = useThreadStore((s) => s.threads);
  const fetchChannelThreads = useThreadStore((s) => s.fetchChannelThreads);
  const markChannelRead = useUnreadStore((s) => s.markChannelRead);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Fetch threads when channel changes
  useEffect(() => {
    if (selectedChannelId) {
      fetchChannelThreads(selectedChannelId);
    }
  }, [selectedChannelId, fetchChannelThreads]);

  // Auto-mark channel as read when last message is visible
  useEffect(() => {
    if (!selectedChannelId || messages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          clearTimeout(markReadTimerRef.current);
          markReadTimerRef.current = setTimeout(() => {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg) {
              markChannelRead(selectedChannelId, lastMsg.id);
            }
          }, 500);
        }
      },
      { threshold: 0.5 },
    );

    if (lastMessageRef.current) {
      observer.observe(lastMessageRef.current);
    }

    return () => {
      observer.disconnect();
      clearTimeout(markReadTimerRef.current);
    };
  }, [selectedChannelId, messages, markChannelRead]);

  // Build a lookup from parentMessageId -> thread
  const threadByMessage = useMemo(() => {
    const map = new Map<string, Thread>();
    for (const t of threads) {
      map.set(t.parentMessageId, t);
    }
    return map;
  }, [threads]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !selectedChannelId) return;
    if (el.scrollTop < 100 && hasMore && !isLoading) {
      loadMoreMessages(selectedChannelId);
    }
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    setIsAtBottom(nearBottom);
  }, [selectedChannelId, hasMore, isLoading, loadMoreMessages]);

  useEffect(() => {
    if (isAtBottom && lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isAtBottom]);

  if (!selectedChannelId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<HashIcon />}
          heading="Select a channel"
          subtext="Pick a channel from the sidebar to start chatting"
        />
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
    <div className="relative flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scrollbar-thin"
      >
        <div className="flex flex-col py-4">
          {messages.length === 0 && (
            <EmptyState
              icon={<ChatBubbleIcon />}
              heading="No messages yet"
              subtext="Be the first to say something!"
            />
          )}
          {messages.map((msg, i) => {
            const prev = i > 0 ? messages[i - 1] : undefined;
            const grouped = isGrouped(msg, prev);
            return (
              <MessageRow
                key={msg.id}
                message={msg}
                grouped={grouped}
                thread={threadByMessage.get(msg.id)}
                isNew={newMessageIds.has(msg.id)}
                onAnimationEnd={() => clearNewFlag(msg.id)}
              />
            );
          })}
          <div ref={lastMessageRef} className="h-px" />
        </div>
      </div>
      {!isAtBottom && messages.length > 0 && (
        <button
          onClick={() => lastMessageRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg-elevated shadow-lg transition-opacity hover:bg-bg-content"
          title="Jump to bottom"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------- SVG Icons ----------

function SmileActionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 13s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ThreadCreateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="10" x2="15" y2="10" />
    </svg>
  );
}

function HashIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
