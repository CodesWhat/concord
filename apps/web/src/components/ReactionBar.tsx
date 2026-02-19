import { useState, useRef } from "react";
import { useReactionStore, type Reaction } from "../stores/reactionStore.js";
import { useAuthStore } from "../stores/authStore.js";
import EmojiPicker from "./EmojiPicker.js";

interface ReactionBarProps {
  messageId: string;
  channelId: string;
  reactions: Reaction[];
}

export default function ReactionBar({ messageId, channelId, reactions }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const addReaction = useReactionStore((s) => s.addReaction);
  const removeReaction = useReactionStore((s) => s.removeReaction);
  const userId = useAuthStore((s) => s.user?.id);

  const handleToggle = (emoji: string, hasReacted: boolean) => {
    if (hasReacted) {
      removeReaction(channelId, messageId, emoji);
    } else {
      addReaction(channelId, messageId, emoji);
    }
  };

  const handlePickerSelect = (emoji: string) => {
    addReaction(channelId, messageId, emoji);
  };

  const addBtnRect = addBtnRef.current?.getBoundingClientRect() ?? null;

  if (reactions.length === 0 && !pickerOpen) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => {
        const hasReacted = userId ? reaction.userIds.includes(userId) : false;
        return (
          <button
            key={reaction.emoji}
            onClick={() => handleToggle(reaction.emoji, hasReacted)}
            title={`${reaction.count} reaction${reaction.count !== 1 ? "s" : ""}`}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary/50 outline-none ${
              hasReacted
                ? "bg-primary/20 ring-1 ring-primary text-text-primary"
                : "bg-bg-elevated text-text-secondary hover:bg-bg-content"
            }`}
          >
            <span>{reaction.emoji}</span>
            <span className="text-xs font-medium">{reaction.count}</span>
          </button>
        );
      })}
      <button
        ref={addBtnRef}
        onClick={() => setPickerOpen((prev) => !prev)}
        title="Add reaction"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-elevated text-text-muted hover:bg-bg-content hover:text-text-secondary focus-visible:ring-1 focus-visible:ring-primary/50 outline-none transition-colors"
        aria-label="Add reaction"
      >
        <SmileIcon />
      </button>
      {pickerOpen && addBtnRect && (
        <EmojiPicker
          onSelect={handlePickerSelect}
          onClose={() => setPickerOpen(false)}
          anchorRect={addBtnRect}
        />
      )}
    </div>
  );
}

function SmileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 13s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
    </svg>
  );
}
