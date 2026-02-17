import { useState, useEffect } from "react";
import { api } from "../api/client.js";
import { useServerStore } from "../stores/serverStore";
import { useChannelStore } from "../stores/channelStore";
import { useAuthStore } from "../stores/authStore";

interface ServerSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ServerSettingsModal({ open, onClose }: ServerSettingsModalProps) {
  const [tab, setTab] = useState<"overview" | "channels">("overview");
  const servers = useServerStore((s) => s.servers);
  const selectedServerId = useServerStore((s) => s.selectedServerId);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const channels = useChannelStore((s) => s.channels);
  const fetchChannels = useChannelStore((s) => s.fetchChannels);
  const userId = useAuthStore((s) => s.user?.id);

  const server = servers.find((s) => s.id === selectedServerId);
  const isOwner = server?.ownerId === userId;

  const [name, setName] = useState(server?.name ?? "");
  const [description, setDescription] = useState(server?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Channel creation
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice" | "announcement">("text");

  useEffect(() => {
    if (server) {
      setName(server.name);
      setDescription(server.description ?? "");
    }
  }, [server]);

  if (!open || !server || !selectedServerId) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/v1/servers/${selectedServerId}`, { name: name.trim(), description: description.trim() });
      await fetchServers();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/v1/servers/${selectedServerId}`);
      await fetchServers();
      onClose();
    } catch {
      // ignore
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
      await api.post(`/api/v1/servers/${selectedServerId}/channels`, {
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
        type: newChannelType,
      });
      setNewChannelName("");
      await fetchChannels(selectedServerId);
    } catch {
      // ignore
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      await api.delete(`/api/v1/channels/${channelId}`);
      await fetchChannels(selectedServerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in" onClick={onClose}>
      <div className="flex h-[480px] w-full max-w-xl overflow-hidden rounded-xl bg-bg-sidebar shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="flex w-44 flex-col bg-bg-deepest p-3">
          <h3 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Server Settings
          </h3>
          <button
            onClick={() => setTab("overview")}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${tab === "overview" ? "bg-bg-elevated text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab("channels")}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${tab === "channels" ? "bg-bg-elevated text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
          >
            Channels
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">
              {tab === "overview" ? "Server Overview" : "Channels"}
            </h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-secondary text-xl">&times;</button>
          </div>

          {tab === "overview" && (
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Server Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg bg-bg-deepest px-3 py-2 text-sm text-text-primary outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg bg-bg-deepest px-3 py-2 text-sm text-text-primary outline-none"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/80 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              {isOwner && (
                <div className="mt-auto border-t border-border pt-4">
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Delete Server
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-red-400">Are you sure? This cannot be undone.</span>
                      <button
                        onClick={handleDelete}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-sm text-text-muted hover:text-text-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "channels" && (
            <div className="flex flex-1 flex-col">
              <div className="flex-1 overflow-y-auto">
                {channels.map((ch) => (
                  <div key={ch.id} className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-bg-content">
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <span className="text-text-muted">{ch.type === "voice" ? "\uD83D\uDD0A" : "#"}</span>
                      {ch.name}
                    </div>
                    <button
                      onClick={() => handleDeleteChannel(ch.id)}
                      className="text-text-muted hover:text-red-400 text-xs opacity-0 group-hover:opacity-100"
                      title="Delete channel"
                    >
                      &#10005;
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Create Channel
                </label>
                <div className="flex gap-2">
                  <input
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="channel-name"
                    className="flex-1 rounded-lg bg-bg-deepest px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
                  />
                  <select
                    value={newChannelType}
                    onChange={(e) => setNewChannelType(e.target.value as "text" | "voice" | "announcement")}
                    className="appearance-none cursor-pointer rounded-lg bg-bg-deepest px-2 py-2 pr-8 text-sm text-text-primary outline-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23A1A1AA' stroke-width='2' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 6px center",
                      backgroundSize: "16px",
                    }}
                  >
                    <option value="text">Text</option>
                    <option value="voice">Voice</option>
                    <option value="announcement">Announce</option>
                  </select>
                  <button
                    onClick={handleCreateChannel}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/80"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
