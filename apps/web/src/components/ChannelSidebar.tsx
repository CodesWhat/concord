import { useState, useRef, useEffect, useCallback } from "react";
import { useChannelStore } from "../stores/channelStore";
import { useServerStore } from "../stores/serverStore";
import { useMessageStore } from "../stores/messageStore";
import { useAuthStore } from "../stores/authStore";
import { usePresenceStore } from "../stores/presenceStore";
import { api, uploadMultipart } from "../api/client.js";
import type { ChannelType } from "@concord/shared";
import {
  HashIcon, SpeakerIcon, ForumIcon, ChevronIcon, ChevronDownIcon,
  BackIcon, MicIcon, HeadphoneIcon, GearIcon,
} from "./ChannelSidebarIcons";
import InviteModal from "./InviteModal";
import ServerSettingsModal from "./ServerSettingsModal";
import { useUnreadStore } from "../stores/unreadStore.js";
import { Badge } from "./ui/Badge.js";
import EmptyState from "./EmptyState.js";
import { getAvatarColor } from "../utils/colors.js";

interface ChannelItemProps {
  channel: { id: string; name: string; type: ChannelType };
  isActive: boolean;
  onClick: () => void;
}

function ChannelItem({ channel, isActive, onClick }: ChannelItemProps) {
  const unread = useUnreadStore((s) => s.getUnreadForChannel(channel.id));
  const hasUnread = unread.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 outline-none ${
        isActive
          ? "bg-bg-elevated text-text-primary"
          : "text-text-muted hover:text-text-secondary hover:bg-bg-elevated/50"
      }`}
    >
      {channel.type === "forum" ? <ForumIcon /> : channel.type === "voice" ? <SpeakerIcon /> : <HashIcon />}
      <span
        className={`truncate group-hover:text-text-secondary ${hasUnread && !isActive ? "font-semibold text-text-primary" : ""}`}
      >
        {channel.name}
      </span>
      {unread.mentionCount > 0 && (
        <span className="ml-auto">
          <Badge count={unread.mentionCount} />
        </span>
      )}
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
        className="flex w-full items-center gap-0.5 px-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
      >
        <ChevronIcon collapsed={collapsed} />
        {categoryName}
      </button>
      <div className={`grid ${collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"} transition-[grid-template-rows] duration-200`}>
        <div className="overflow-hidden">
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
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg-elevated hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
    >
      {children}
    </button>
  );
}

function UserSettingsPopover({ user, onClose }: { user: { id?: string; name?: string; email?: string; bio?: string; avatarUrl?: string | null }; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.name ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/auth/login";
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const result = await uploadMultipart<{ avatarUrl: string }>("/api/v1/users/@me/avatar", formData);
      updateProfile({ avatarUrl: result.avatarUrl });
    } catch {
      // revert preview on failure
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = displayName.trim();
    const trimmedBio = bio.trim();
    if (!trimmedName) return;
    setSaving(true);
    try {
      await api.patch("/api/v1/users/@me", { displayName: trimmedName, bio: trimmedBio });
      updateProfile({ name: trimmedName, bio: trimmedBio });
      setEditing(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = avatarPreview ?? user.avatarUrl;

  return (
    <div ref={ref} className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg bg-bg-elevated p-3 shadow-lg border border-border animate-scale-in">
      {/* Avatar + Name header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={handleAvatarClick}
          className="relative shrink-0 group focus-visible:ring-2 focus-visible:ring-primary/50 outline-none rounded-full"
          title="Change avatar"
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="Avatar" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold"
              style={{ backgroundColor: getAvatarColor(user.id ?? "").bg, color: getAvatarColor(user.id ?? "").text }}
            >
              {user.name?.charAt(0) ?? "?"}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-text-primary truncate">{user.name ?? "Unknown"}</div>
          <div className="text-xs text-text-muted truncate">{user.email ?? ""}</div>
        </div>
      </div>

      <div className="h-px bg-border my-2" />

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 64))}
              className="w-full rounded-md bg-bg-deepest px-2.5 py-1.5 text-sm text-text-primary border border-border focus:border-primary focus:outline-none"
            />
            <span className="text-xs text-text-muted">{displayName.length}/64</span>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Tell us about yourself"
              className="w-full rounded-md bg-bg-deepest px-2.5 py-1.5 text-sm text-text-primary placeholder-text-muted border border-border focus:border-primary focus:outline-none resize-none"
            />
            <span className="text-xs text-text-muted">{bio.length}/500</span>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setEditing(false); setDisplayName(user.name ?? ""); setBio(user.bio ?? ""); }}
              className="rounded-md px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-content transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!displayName.trim() || saving}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => setEditing(true)}
            className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-content focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-red-400 hover:bg-bg-content focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
          >
            Log Out
          </button>
        </>
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "online", label: "Online", color: "#22C55E" },
  { value: "idle", label: "Idle", color: "#EAB308" },
  { value: "dnd", label: "Do Not Disturb", color: "#EF4444" },
  { value: "offline", label: "Invisible", color: "#71717A" },
] as const;

function StatusSelector({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentStatus = usePresenceStore((s) => s.statuses[userId] ?? "online");
  const updatePresence = usePresenceStore((s) => s.updatePresence);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = async (status: string) => {
    setOpen(false);
    updatePresence(userId, status);
    try {
      await api.patch("/api/v1/users/@me", { status });
    } catch {
      // revert on failure
      updatePresence(userId, currentStatus);
    }
  };

  const current = STATUS_OPTIONS.find((o) => o.value === currentStatus) ?? STATUS_OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-[3px] border-bg-deepest focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
        style={{ backgroundColor: current.color }}
        title={`Status: ${current.label}`}
      />
      {open && (
        <div className="absolute bottom-6 left-0 z-50 w-48 rounded-lg bg-bg-elevated p-1.5 shadow-lg border border-border">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-text-secondary hover:bg-bg-content focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);

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
        <h2 className="flex-1 truncate text-base font-semibold text-text-primary">
          {selectedServer?.name ?? "Select a server"}
        </h2>
        {selectedServer && (
          <button
            onClick={() => setInviteOpen(true)}
            title="Invite People"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-bg-elevated hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </button>
        )}
        <button onClick={() => setSettingsOpen(true)} className="text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/50 outline-none">
          <ChevronDownIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
        {channels.length === 0 && (
          <EmptyState
            icon={<HashIcon />}
            heading="No channels yet"
            subtext="Create a channel to get started"
          />
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
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: getAvatarColor(user?.id ?? "").bg, color: getAvatarColor(user?.id ?? "").text }}
          >
            {user?.name?.charAt(0) ?? "?"}
          </div>
          {user?.id && <StatusSelector userId={user.id} />}
        </div>
        <div className="flex-1 truncate">
          <div className="text-sm font-semibold text-text-primary">
            {user?.name ?? "Unknown"}
          </div>
          <div className="text-xs text-text-muted">{user?.email ?? ""}</div>
        </div>
        <div className="relative flex gap-1">
          <IconButton title="Mute"><MicIcon /></IconButton>
          <IconButton title="Deafen"><HeadphoneIcon /></IconButton>
          <IconButton title="Settings" onClick={() => setUserPopoverOpen((o) => !o)}><GearIcon /></IconButton>
          {userPopoverOpen && user && (
            <UserSettingsPopover user={user} onClose={() => setUserPopoverOpen(false)} />
          )}
        </div>
      </div>
      <ServerSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </aside>
  );
}
