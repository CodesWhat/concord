import { useState, useEffect, useRef, useCallback } from "react";
import { useMessageStore } from "../stores/messageStore.js";
import { useChannelStore } from "../stores/channelStore.js";
import { useUploadStore } from "../stores/uploadStore.js";
import { offlineSync } from "../utils/offlineSync.js";
import { api } from "../api/client.js";
import FileUploadPreview from "./FileUploadPreview.js";

export default function MessageInput({ channelName }: { channelName: string }) {
  const [value, setValue] = useState("");
  const [online, setOnline] = useState(offlineSync.online);
  const [dragOver, setDragOver] = useState(false);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const isSending = useMessageStore((s) => s.isSending);
  const editingMessageId = useMessageStore((s) => s.editingMessageId);
  const setEditingMessage = useMessageStore((s) => s.setEditingMessage);
  const selectedChannelId = useChannelStore((s) => s.selectedChannelId);
  const lastTypingSent = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pendingFiles = useUploadStore((s) => s.pendingFiles);
  const addFiles = useUploadStore((s) => s.addFiles);
  const uploadFiles = useUploadStore((s) => s.uploadFiles);
  const isUploading = useUploadStore((s) => s.isUploading);

  useEffect(() => {
    return offlineSync.subscribe(setOnline);
  }, []);

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
    const hasContent = value.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if ((!hasContent && !hasFiles) || !selectedChannelId || isSending || isUploading) return;

    const content = value.trim();
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    let attachments;
    if (hasFiles) {
      try {
        attachments = await uploadFiles(selectedChannelId);
      } catch {
        return;
      }
    }

    if (content || (attachments && attachments.length > 0)) {
      await sendMessage(selectedChannelId, content, attachments);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addFiles(Array.from(files));
    }
    e.target.value = "";
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        addFiles(imageFiles);
      }
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        addFiles(Array.from(files));
      }
    },
    [addFiles],
  );

  return (
    <div
      className="px-4 pb-6 pt-1"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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

      <FileUploadPreview />

      <div
        className={`flex items-end gap-2 bg-bg-elevated px-4 py-2.5 ${
          editingMessageId ? "rounded-b-lg" : pendingFiles.length > 0 ? "rounded-b-lg" : "rounded-lg"
        } ${dragOver ? "ring-2 ring-primary" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          className="flex shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text-secondary"
          title="Attach file"
          onClick={() => fileInputRef.current?.click()}
        >
          <PlusCircleIcon />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleTyping();
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={online ? `Message #${channelName}` : `Message #${channelName} (offline — will send later)`}
          disabled={!selectedChannelId || isSending || isUploading}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50 max-h-[200px] overflow-y-auto"
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
