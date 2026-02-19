import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchStore } from "../stores/searchStore.js";
import { useServerStore } from "../stores/serverStore.js";
import { useChannelStore } from "../stores/channelStore.js";
import { useMessageStore } from "../stores/messageStore.js";

export default function SearchPanel() {
  const { isOpen, results, isSearching, query, search, clearSearch, close } =
    useSearchStore();
  const selectedServerId = useServerStore((s) => s.selectedServerId);
  const channels = useChannelStore((s) => s.channels);
  const selectChannel = useChannelStore((s) => s.selectChannel);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);

  const [inputValue, setInputValue] = useState("");
  const [filterChannelId, setFilterChannelId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setInputValue(query);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, query]);

  // Keyboard shortcut: Cmd+F opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          useSearchStore.getState().open();
        }
      }
      if (e.key === "Escape" && isOpen) {
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        clearSearch();
        return;
      }
      debounceRef.current = setTimeout(() => {
        if (selectedServerId) {
          search(selectedServerId, value, filterChannelId ? { channelId: filterChannelId } : undefined);
        }
      }, 400);
    },
    [selectedServerId, filterChannelId, search, clearSearch],
  );

  const handleFilterChange = useCallback(
    (channelId: string) => {
      setFilterChannelId(channelId);
      if (inputValue.trim() && selectedServerId) {
        search(selectedServerId, inputValue, channelId ? { channelId } : undefined);
      }
    },
    [inputValue, selectedServerId, search],
  );

  const handleResultClick = useCallback(
    (channelId: string) => {
      selectChannel(channelId);
      fetchMessages(channelId);
      close();
    },
    [selectChannel, fetchMessages, close],
  );

  const handleClear = () => {
    setInputValue("");
    clearSearch();
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  const textChannels = channels.filter(
    (c) => c.type === "text" || c.type === "announcement",
  );

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
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <SearchIcon />
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          {inputValue && (
            <button
              onClick={handleClear}
              className="text-text-muted hover:text-text-secondary transition-colors"
              title="Clear search"
            >
              <XIcon />
            </button>
          )}
          <button
            onClick={close}
            className="ml-1 text-text-muted hover:text-text-secondary transition-colors"
            title="Close search"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Channel filter */}
        {textChannels.length > 0 && (
          <div className="border-b border-border px-4 py-2">
            <select
              value={filterChannelId}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="w-full rounded-md bg-bg-deepest px-2 py-1.5 text-xs text-text-primary outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
            >
              <option value="">All channels</option>
              {textChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  #{ch.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {isSearching && (
            <div className="flex items-center justify-center py-12 text-text-muted text-sm gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Searching...
            </div>
          )}

          {!isSearching && query && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
              <SearchOffIcon />
              <p className="text-sm">No messages found</p>
              <p className="text-xs">Try a different search term</p>
            </div>
          )}

          {!isSearching && !query && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
              <SearchIcon size={32} />
              <p className="text-sm">Search messages in this server</p>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <ul>
              {results.map((result, i) => (
                <li key={result.id}>
                  <button
                    onClick={() => handleResultClick(result.channelId)}
                    className="w-full text-left px-4 py-3 hover:bg-bg-content transition-colors border-b border-border last:border-0 focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
                  >
                    {/* Channel + timestamp */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs text-text-muted">
                        #{result.channelName}
                      </span>
                      <span className="text-xs text-text-muted">·</span>
                      <span className="text-xs text-text-muted">
                        {formatTimestamp(result.createdAt)}
                      </span>
                    </div>

                    {/* Author */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar
                        src={result.author.avatarUrl}
                        name={result.author.displayName || result.author.username}
                      />
                      <span className="text-xs font-medium text-text-secondary">
                        {result.author.displayName || result.author.username}
                      </span>
                    </div>

                    {/* Highlighted content */}
                    <div
                      className="text-sm text-text-secondary line-clamp-3 [&_mark]:bg-primary/20 [&_mark]:text-text-primary [&_mark]:rounded-sm [&_mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: result.highlight || result.content }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        {results.length > 0 && !isSearching && (
          <div className="border-t border-border px-4 py-2 text-xs text-text-muted">
            {results.length} result{results.length !== 1 ? "s" : ""} — click to jump to channel
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function Avatar({
  src,
  name,
}: {
  src: string | null;
  name: string;
}) {
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

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Icons ────────────────────────────────────────────────────────────

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0 text-text-muted"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SearchOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
