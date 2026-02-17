import { useState, useEffect, useRef, useCallback } from "react";
import { useServerStore } from "../stores/serverStore";
import { useChannelStore } from "../stores/channelStore";
import { useMessageStore } from "../stores/messageStore";
import EmptyState from "./EmptyState.js";

interface SearchResult {
  type: "server" | "channel";
  id: string;
  name: string;
  serverId: string;
  serverName: string;
}

export default function QuickSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const servers = useServerStore((s) => s.servers);
  const selectServer = useServerStore((s) => s.selectServer);
  const fetchMembers = useServerStore((s) => s.fetchMembers);
  const channels = useChannelStore((s) => s.channels);
  const selectChannel = useChannelStore((s) => s.selectChannel);
  const fetchChannels = useChannelStore((s) => s.fetchChannels);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Build search results
  const results: SearchResult[] = [];
  const q = query.toLowerCase();

  // Add channels (they're more useful than servers for quick switching)
  for (const ch of channels) {
    const server = servers.find((s) => s.id === ch.serverId);
    if (!server) continue;
    const searchStr = `${ch.name} ${server.name}`.toLowerCase();
    if (!q || searchStr.includes(q)) {
      results.push({
        type: "channel",
        id: ch.id,
        name: ch.name,
        serverId: ch.serverId,
        serverName: server.name,
      });
    }
  }

  // Add servers
  for (const s of servers) {
    if (!q || s.name.toLowerCase().includes(q)) {
      results.push({
        type: "server",
        id: s.id,
        name: s.name,
        serverId: s.id,
        serverName: s.name,
      });
    }
  }

  // Clamp selected index
  const clampedIndex = Math.min(selectedIndex, results.length - 1);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      if (result.type === "channel") {
        selectServer(result.serverId);
        fetchChannels(result.serverId);
        fetchMembers(result.serverId);
        selectChannel(result.id);
        fetchMessages(result.id);
      } else {
        selectServer(result.id);
        fetchChannels(result.id);
        fetchMembers(result.id);
      }
    },
    [selectServer, fetchChannels, fetchMembers, selectChannel, fetchMessages],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[clampedIndex]) {
        handleSelect(results[clampedIndex]);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-bg-sidebar shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Where would you like to go?"
            className="w-full bg-transparent text-lg text-text-primary placeholder:text-text-muted outline-none"
          />
        </div>

        <div className="border-t border-border max-h-80 overflow-y-auto">
          {results.length === 0 && (
            <EmptyState
              icon={<SearchOffIcon />}
              heading="No results found"
              subtext="Try a different search term"
            />
          )}
          {results.slice(0, 20).map((result, i) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 outline-none ${
                i === clampedIndex
                  ? "bg-primary/20 text-text-primary"
                  : "text-text-secondary hover:bg-bg-content"
              }`}
            >
              {result.type === "channel" ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-deepest text-sm text-text-muted">
                  #
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                  {result.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {result.name}
                </div>
                {result.type === "channel" && (
                  <div className="truncate text-xs text-text-muted">
                    {result.serverName}
                  </div>
                )}
              </div>
              <span className="shrink-0 text-xs text-text-muted">
                {result.type === "channel" ? "Channel" : "Server"}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-xs text-text-muted">
          <span>
            <kbd className="rounded bg-bg-deepest px-1.5 py-0.5 text-[10px] font-mono">
              ↑↓
            </kbd>{" "}
            Navigate
          </span>
          <span>
            <kbd className="rounded bg-bg-deepest px-1.5 py-0.5 text-[10px] font-mono">
              Enter
            </kbd>{" "}
            Select
          </span>
          <span>
            <kbd className="rounded bg-bg-deepest px-1.5 py-0.5 text-[10px] font-mono">
              Esc
            </kbd>{" "}
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

function SearchOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}
