import { useRef, useEffect, useState, useCallback } from "react";
import { useDmStore, type DmMessage, type DmChannel } from "../stores/dmStore.js";
import { getAvatarColor } from "../utils/colors.js";
import { formatTime } from "../utils/format.js";
import Markdown from "./Markdown.js";
import EmptyState from "./EmptyState.js";

function isGrouped(current: DmMessage, prev: DmMessage | undefined): boolean {
  if (!prev) return false;
  if (prev.authorId !== current.authorId) return false;
  const diff =
    new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return diff < 5 * 60 * 1000;
}

function DmMessageRow({
  message,
  grouped,
  isNew,
  onAnimationEnd,
}: {
  message: DmMessage;
  grouped: boolean;
  isNew?: boolean;
  onAnimationEnd?: () => void;
}) {
  const authorName = message.author?.displayName ?? "Unknown";
  const initial = authorName.charAt(0);
  const avatarColors = getAvatarColor(message.authorId);

  const content = (
    <div className="text-sm leading-relaxed text-text-primary">
      <Markdown content={message.content} />
      {message.editedAt && (
        <span className="ml-1 text-xs text-text-muted">(edited)</span>
      )}
    </div>
  );

  if (grouped) {
    return (
      <div
        className={`group relative flex items-start px-4 py-0.5 hover:bg-bg-elevated/50 ${isNew ? "animate-slide-up" : ""}`}
        onAnimationEnd={onAnimationEnd}
      >
        <div className="w-10 shrink-0 mr-4" />
        <div className="min-w-0 flex-1">{content}</div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-start px-4 py-2 hover:bg-bg-elevated/50 ${isNew ? "animate-slide-up" : ""}`}
      onAnimationEnd={onAnimationEnd}
    >
      {message.author?.avatarUrl ? (
        <img
          src={message.author.avatarUrl}
          alt={authorName}
          className="mr-4 h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
        >
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {authorName}
          </span>
          <span className="text-xs text-text-secondary">
            {formatTime(message.createdAt)}
          </span>
        </div>
        {content}
      </div>
    </div>
  );
}

function DmInput({
  dmChannelId,
  recipientName,
}: {
  dmChannelId: string;
  recipientName: string;
}) {
  const [value, setValue] = useState("");
  const sendMessage = useDmStore((s) => s.sendMessage);
  const isSending = useDmStore((s) => s.isSending);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage(dmChannelId, trimmed);
  }, [value, isSending, dmChannelId, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-4 pb-6 pt-1">
      <div className="flex items-end gap-2 rounded-lg bg-bg-elevated px-4 py-2.5">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height =
              Math.min(e.target.scrollHeight, 200) + "px";
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Message @${recipientName}`}
          disabled={isSending}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50 max-h-[200px] overflow-y-auto"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isSending}
          className="flex shrink-0 items-center justify-center rounded-md p-1 text-text-muted hover:text-text-secondary disabled:opacity-40"
          title="Send"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

function DmHeader({ channel }: { channel: DmChannel }) {
  const { participant } = channel;
  const avatarColors = getAvatarColor(participant.id);
  const initial = participant.displayName.charAt(0);

  return (
    <div className="flex h-12 items-center gap-3 border-b border-border px-4">
      {participant.avatarUrl ? (
        <img
          src={participant.avatarUrl}
          alt={participant.displayName}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
          style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
        >
          {initial}
        </div>
      )}
      <span className="text-sm font-semibold text-text-primary">
        {participant.displayName}
      </span>
      <span className="text-xs text-text-muted">@{participant.username}</span>
    </div>
  );
}

export default function DmView() {
  const selectedDmChannelId = useDmStore((s) => s.selectedDmChannelId);
  const dmChannels = useDmStore((s) => s.dmChannels);
  const messages = useDmStore((s) => s.messages);
  const isLoading = useDmStore((s) => s.isLoading);
  const hasMoreMessages = useDmStore((s) => s.hasMoreMessages);
  const loadMoreMessages = useDmStore((s) => s.loadMoreMessages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const prevMessagesLenRef = useRef(0);

  const selectedChannel = selectedDmChannelId
    ? dmChannels.find((ch) => ch.id === selectedDmChannelId)
    : null;

  // Track new messages for animation
  useEffect(() => {
    if (messages.length > prevMessagesLenRef.current) {
      const newOnes = messages.slice(prevMessagesLenRef.current);
      setNewMessageIds((prev) => {
        const next = new Set(prev);
        for (const m of newOnes) next.add(m.id);
        return next;
      });
    }
    prevMessagesLenRef.current = messages.length;
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  if (!selectedDmChannelId || !selectedChannel) {
    return (
      <main className="flex flex-1 flex-col bg-bg-content min-w-0">
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<ChatBubbleIcon />}
            heading="Select a conversation"
            subtext="Choose a DM from the sidebar to start chatting"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-bg-content min-w-0">
      <DmHeader channel={selectedChannel} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <EmptyState
              icon={<ChatBubbleIcon />}
              heading="Start the conversation"
              subtext={`This is the beginning of your DM with ${selectedChannel.participant.displayName}`}
            />
          </div>
        ) : (
          <div className="flex flex-col py-4">
            {hasMoreMessages && (
              <button
                onClick={() => selectedDmChannelId && loadMoreMessages(selectedDmChannelId)}
                className="mx-auto my-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Load older messages
              </button>
            )}
            {messages.map((msg, i) => {
              const prev = i > 0 ? messages[i - 1] : undefined;
              const grouped = isGrouped(msg, prev);
              return (
                <DmMessageRow
                  key={msg.id}
                  message={msg}
                  grouped={grouped}
                  isNew={newMessageIds.has(msg.id)}
                  onAnimationEnd={() => {
                    setNewMessageIds((prev) => {
                      const next = new Set(prev);
                      next.delete(msg.id);
                      return next;
                    });
                  }}
                />
              );
            })}
            <div ref={lastMessageRef} className="h-px" />
          </div>
        )}
      </div>

      <DmInput
        dmChannelId={selectedDmChannelId}
        recipientName={selectedChannel.participant.displayName}
      />
    </main>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
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
