import { useState, useEffect, useRef } from "react";
import { useMessageStore } from "../stores/messageStore.js";
import { useChannelStore } from "../stores/channelStore.js";
import { api } from "../api/client.js";

export default function MessageInput({ channelName }: { channelName: string }) {
  const [value, setValue] = useState("");
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const isSending = useMessageStore((s) => s.isSending);
  const editingMessageId = useMessageStore((s) => s.editingMessageId);
  const setEditingMessage = useMessageStore((s) => s.setEditingMessage);
  const selectedChannelId = useChannelStore((s) => s.selectedChannelId);
  const lastTypingSent = useRef(0);

  const handleTyping = () => {
    if (!selectedChannelId) return;
    const now = Date.now();
    if (now - lastTypingSent.current > 5000) {
      lastTypingSent.current = now;
      api.post(`/api/v1/channels/${selectedChannelId}/typing`).catch(() => {});
    }
  };

  // Cancel edit mode on Escape when the main input is focused
  useEffect(() => {
    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingMessageId) {
        setEditingMessage(null);
      }
    };
    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, [editingMessageId, setEditingMessage]);

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
      {editingMessageId && (
        <div className="mb-1 flex items-center justify-between rounded-t-lg bg-bg-elevated px-4 py-1.5">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <EditingPencilIcon />
            <span>Editing message</span>
          </div>
          <button
            onClick={() => setEditingMessage(null)}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Cancel
          </button>
        </div>
      )}
      <div className={`flex items-center gap-2 bg-bg-elevated px-4 py-2.5 ${editingMessageId ? "rounded-b-lg" : "rounded-lg"}`}>
        <button
          className="flex shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text-secondary"
          title="Attach file"
        >
          <PlusCircleIcon />
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleTyping();
          }}
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

function EditingPencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
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
