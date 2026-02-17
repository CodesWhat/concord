import { useState } from "react";
import { useMessageStore } from "../stores/messageStore";
import { useChannelStore } from "../stores/channelStore";

export default function MessageInput({ channelName }: { channelName: string }) {
  const [value, setValue] = useState("");
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const isSending = useMessageStore((s) => s.isSending);
  const selectedChannelId = useChannelStore((s) => s.selectedChannelId);

  const handleSubmit = async () => {
    if (!value.trim() || !selectedChannelId || isSending) return;
    const content = value.trim();
    setValue("");
    await sendMessage(selectedChannelId, content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-4 pb-6 pt-1">
      <div className="flex items-center gap-2 rounded-lg bg-bg-elevated px-4 py-2.5">
        <button
          className="flex shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text-secondary"
          title="Attach file"
        >
          <PlusCircleIcon />
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`}
          disabled={!selectedChannelId || isSending}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50"
        />
        <button
          className="flex shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text-secondary"
          title="Emoji"
        >
          <EmojiIcon />
        </button>
      </div>
    </div>
  );
}

function PlusCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}
