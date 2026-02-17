import { useState } from "react";
import { useChannelStore } from "../stores/channelStore";
import { useServerStore } from "../stores/serverStore";
import { useMessageStore } from "../stores/messageStore";
import { useAuthStore } from "../stores/authStore";
import type { ChannelType } from "@concord/shared";
import {
  HashIcon, SpeakerIcon, ChevronIcon, ChevronDownIcon,
  BackIcon, MicIcon, HeadphoneIcon, GearIcon,
} from "./ChannelSidebarIcons";

interface ChannelItemProps {
  channel: { id: string; name: string; type: ChannelType };
  isActive: boolean;
  onClick: () => void;
}

function ChannelItem({ channel, isActive, onClick }: ChannelItemProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors"
      style={{
        backgroundColor: isActive ? "var(--color-bg-elevated)" : "transparent",
        color: isActive ? "var(--color-text-primary)" : "var(--color-text-muted)",
      }}
    >
      {channel.type === "voice" ? <SpeakerIcon /> : <HashIcon />}
      <span className="truncate group-hover:text-text-secondary">
        {channel.name}
      </span>
    </button>
  );
}

function CategorySection({
  categoryName,
  channels,
  activeChannelId,
  onSelectChannel,
}: {
  categoryName: string;
  channels: Array<{ id: string; name: string; type: ChannelType }>;
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-0.5 px-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary"
      >
        <ChevronIcon collapsed={collapsed} />
        {categoryName}
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-0.5 px-0.5">
          {channels.map((ch) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              isActive={ch.id === activeChannelId}
              onClick={() => onSelectChannel(ch.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IconButton({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
    >
      {children}
    </button>
  );
}

export default function ChannelSidebar({ onBack }: { onBack?: () => void }) {
  const channels = useChannelStore((s) => s.channels);
  const categories = useChannelStore((s) => s.categories);
  const selectedChannelId = useChannelStore((s) => s.selectedChannelId);
  const selectChannel = useChannelStore((s) => s.selectChannel);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const servers = useServerStore((s) => s.servers);
  const selectedServerId = useServerStore((s) => s.selectedServerId);
  const user = useAuthStore((s) => s.user);

  const selectedServer = servers.find((s) => s.id === selectedServerId);

  const handleSelectChannel = (id: string) => {
    selectChannel(id);
    fetchMessages(id);
  };

  // Group channels by category
  const grouped = categories.map((cat) => ({
    category: cat,
    channels: channels.filter((ch) => ch.categoryId === cat.id),
  }));

  // Uncategorized channels
  const uncategorized = channels.filter((ch) => !ch.categoryId);

  return (
    <aside className="flex h-full w-60 min-w-60 flex-col bg-bg-sidebar">
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        {onBack && (
          <button onClick={onBack} className="mr-2 text-text-secondary md:hidden">
            <BackIcon />
          </button>
        )}
        <h2 className="truncate text-base font-semibold text-text-primary">
          {selectedServer?.name ?? "Select a server"}
        </h2>
        <button className="text-text-muted hover:text-text-secondary">
          <ChevronDownIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
        {channels.length === 0 && (
          <p className="px-2 py-4 text-sm text-text-muted">No channels</p>
        )}
        {uncategorized.length > 0 && (
          <CategorySection
            categoryName="Channels"
            channels={uncategorized}
            activeChannelId={selectedChannelId}
            onSelectChannel={handleSelectChannel}
          />
        )}
        {grouped.map((g) => (
          <CategorySection
            key={g.category.id}
            categoryName={g.category.name}
            channels={g.channels}
            activeChannelId={selectedChannelId}
            onSelectChannel={handleSelectChannel}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-bg-deepest px-2 py-2">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            {user?.name?.charAt(0) ?? "?"}
          </div>
        </div>
        <div className="flex-1 truncate">
          <div className="text-sm font-semibold text-text-primary">
            {user?.name ?? "Unknown"}
          </div>
          <div className="text-xs text-text-muted">{user?.email ?? ""}</div>
        </div>
        <div className="flex gap-1">
          <IconButton title="Mute"><MicIcon /></IconButton>
          <IconButton title="Deafen"><HeadphoneIcon /></IconButton>
          <IconButton title="Settings"><GearIcon /></IconButton>
        </div>
      </div>
    </aside>
  );
}
