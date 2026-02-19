import { useEffect } from "react";
import { useDmStore, type DmChannel } from "../stores/dmStore.js";
import { useAuthStore } from "../stores/authStore.js";
import { usePresenceStore } from "../stores/presenceStore.js";
import { getAvatarColor } from "../utils/colors.js";
import { formatTime } from "../utils/format.js";
import EmptyState from "./EmptyState.js";

function DmChannelRow({
  channel,
  isActive,
  onClick,
  unreadCount,
}: {
  channel: DmChannel;
  isActive: boolean;
  onClick: () => void;
  unreadCount: number;
}) {
  const { participant } = channel;
  const status = usePresenceStore((s) => s.statuses[participant.id] ?? participant.status);
  const initial = participant.displayName.charAt(0);
  const avatarColors = getAvatarColor(participant.id);

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 outline-none ${
        isActive
          ? "bg-bg-elevated text-text-primary"
          : "text-text-muted hover:text-text-secondary hover:bg-bg-elevated/50"
      }`}
    >
      <div className="relative shrink-0">
        {participant.avatarUrl ? (
          <img
            src={participant.avatarUrl}
            alt={participant.displayName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
          >
            {initial}
          </div>
        )}
        <div
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-sidebar"
          style={{
            backgroundColor:
              status === "online" ? "#22C55E"
              : status === "idle" ? "#EAB308"
              : status === "dnd" ? "#EF4444"
              : "#71717A",
          }}
        />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className={`truncate text-sm font-medium ${isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"}`}>
          {participant.displayName}
        </div>
        {channel.lastMessage && (
          <div className="truncate text-xs text-text-muted">
            {channel.lastMessage.content}
          </div>
        )}
      </div>
      {channel.lastMessage && (
        <span className="shrink-0 text-[10px] text-text-muted">
          {formatTime(channel.lastMessage.createdAt)}
        </span>
      )}
      {unreadCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}

export default function DmList() {
  const dmChannels = useDmStore((s) => s.dmChannels);
  const selectedDmChannelId = useDmStore((s) => s.selectedDmChannelId);
  const fetchDmChannels = useDmStore((s) => s.fetchDmChannels);
  const selectDmChannel = useDmStore((s) => s.selectDmChannel);
  const isLoading = useDmStore((s) => s.isLoading);
  const unreadCounts = useDmStore((s) => s.unreadCounts);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchDmChannels();
  }, [fetchDmChannels]);

  return (
    <aside className="flex h-full w-60 min-w-60 flex-col bg-bg-sidebar">
      <div className="flex h-12 items-center border-b border-border px-4">
        <h2 className="text-base font-semibold text-text-primary">
          Direct Messages
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
        {isLoading && dmChannels.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : dmChannels.length === 0 ? (
          <EmptyState
            icon={<ChatIcon />}
            heading="No direct messages"
            subtext="Start a conversation by clicking Message on a member"
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            {dmChannels.map((ch) => (
              <DmChannelRow
                key={ch.id}
                channel={ch}
                isActive={ch.id === selectedDmChannelId}
                onClick={() => selectDmChannel(ch.id)}
                unreadCount={unreadCounts[ch.id] ?? 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Current user info at bottom */}
      {user && (
        <div className="flex items-center gap-2 border-t border-border bg-bg-deepest px-3 py-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ backgroundColor: getAvatarColor(user.id ?? "").bg, color: getAvatarColor(user.id ?? "").text }}
          >
            {user.name?.charAt(0) ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-text-primary">
              {user.name ?? "Unknown"}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
