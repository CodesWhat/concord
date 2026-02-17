import { useRef, useCallback, useState } from "react";
import { useMessageStore, type Message } from "../stores/messageStore.js";
import { useChannelStore } from "../stores/channelStore.js";
import { useAuthStore } from "../stores/authStore.js";
import Markdown from "./Markdown.js";

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
  onEdit,
  onDelete,
}: {
  message: Message;
  isOwnMessage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="absolute -top-4 right-2 hidden gap-0.5 rounded-md border border-border bg-bg-elevated px-1 py-0.5 shadow-lg group-hover:flex">
      <ActionBtn title="Reply"><ReplyIcon /></ActionBtn>
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
      className={`flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-bg-content hover:text-text-secondary ${extraClass ?? ""}`}
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
    <div className="mt-2 flex items-center gap-3 rounded-md border border-border bg-bg-deepest px-3 py-2">
      <span className="text-sm text-text-secondary">
        Delete this message? This cannot be undone.
      </span>
      <button
        onClick={onConfirm}
        className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
      >
        Delete
      </button>
      <button
        onClick={onCancel}
        className="rounded-md bg-bg-elevated px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-content"
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
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/80"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-md bg-bg-elevated px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-content"
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
}: {
  message: Message;
  grouped: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);
  const selectedChannelId = useChannelStore((s) => s.selectedChannelId);
  const editingMessageId = useMessageStore((s) => s.editingMessageId);
  const setEditingMessage = useMessageStore((s) => s.setEditingMessage);
  const editMessage = useMessageStore((s) => s.editMessage);
  const deleteMessage = useMessageStore((s) => s.deleteMessage);

  const isOwnMessage = userId === message.authorId;
  const isEditing = editingMessageId === message.id;
  const authorName = message.author?.displayName ?? "Unknown";
  const initial = authorName.charAt(0);

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

  if (grouped) {
    return (
      <div className={`group relative flex items-start px-4 py-0.5 hover:bg-bg-elevated/50 ${isEditing ? "bg-bg-elevated/30" : ""}`}>
        <div className="w-10 shrink-0 mr-4" />
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-text-primary">
          {messageContent}
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
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`group relative flex items-start px-4 py-2 hover:bg-bg-elevated/50 ${isEditing ? "bg-bg-elevated/30" : ""}`}>
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
          {messageContent}
        </div>
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
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ---------- MessageList ----------

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

// ---------- SVG Icons ----------

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
