import { useEffect, useState } from "react";
import { Permissions } from "@concord/shared";
import { useServerStore } from "../stores/serverStore";
import { api } from "../api/client";
import { Button } from "./ui/Button";

interface ChannelPermissionsEditorProps {
  channelId: string;
  serverId: string;
  overrides: Record<string, { allow: number; deny: number }>;
  onClose: () => void;
}

type OverrideState = "inherit" | "allow" | "deny";

const CHANNEL_PERMISSIONS = [
  { key: "READ_MESSAGES", label: "Read Messages", bit: Permissions.READ_MESSAGES },
  { key: "SEND_MESSAGES", label: "Send Messages", bit: Permissions.SEND_MESSAGES },
  { key: "MANAGE_MESSAGES", label: "Manage Messages", bit: Permissions.MANAGE_MESSAGES },
  { key: "EMBED_LINKS", label: "Embed Links", bit: Permissions.EMBED_LINKS },
  { key: "ATTACH_FILES", label: "Attach Files", bit: Permissions.ATTACH_FILES },
  { key: "MENTION_EVERYONE", label: "Mention Everyone", bit: Permissions.MENTION_EVERYONE },
  { key: "ADD_REACTIONS", label: "Add Reactions", bit: Permissions.ADD_REACTIONS },
  { key: "CONNECT_VOICE", label: "Connect (Voice)", bit: Permissions.CONNECT_VOICE },
  { key: "SPEAK", label: "Speak (Voice)", bit: Permissions.SPEAK },
  { key: "MANAGE_THREADS", label: "Manage Threads", bit: Permissions.MANAGE_THREADS },
  { key: "SEND_MESSAGES_THREADS", label: "Send in Threads", bit: Permissions.SEND_MESSAGES_THREADS },
] as const;

function getOverrideState(allow: number, deny: number, bit: number): OverrideState {
  if ((deny & bit) !== 0) return "deny";
  if ((allow & bit) !== 0) return "allow";
  return "inherit";
}

function cycleState(current: OverrideState): OverrideState {
  if (current === "inherit") return "allow";
  if (current === "allow") return "deny";
  return "inherit";
}

export default function ChannelPermissionsEditor({
  channelId,
  serverId,
  overrides: initialOverrides,
  onClose,
}: ChannelPermissionsEditorProps) {
  const { roles, fetchRoles } = useServerStore();
  const [overrides, setOverrides] = useState(initialOverrides);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoles(serverId);
  }, [serverId, fetchRoles]);

  useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      setSelectedRoleId(roles[0]!.id);
    }
  }, [roles, selectedRoleId]);

  const selectedOverride = selectedRoleId ? overrides[selectedRoleId] ?? { allow: 0, deny: 0 } : null;

  const togglePermission = (bit: number) => {
    if (!selectedRoleId || !selectedOverride) return;

    const current = getOverrideState(selectedOverride.allow, selectedOverride.deny, bit);
    const next = cycleState(current);

    let { allow, deny } = selectedOverride;

    // Clear the bit from both
    allow = allow & ~bit;
    deny = deny & ~bit;

    // Set new state
    if (next === "allow") allow = allow | bit;
    if (next === "deny") deny = deny | bit;

    setOverrides({
      ...overrides,
      [selectedRoleId]: { allow, deny },
    });
  };

  const handleSave = async () => {
    if (!selectedRoleId || !selectedOverride) return;
    setSaving(true);
    try {
      const override = overrides[selectedRoleId] ?? { allow: 0, deny: 0 };
      if (override.allow === 0 && override.deny === 0) {
        await api.delete(`/api/v1/channels/${channelId}/permissions/${selectedRoleId}`);
        const next = { ...overrides };
        delete next[selectedRoleId];
        setOverrides(next);
      } else {
        await api.put(`/api/v1/channels/${channelId}/permissions/${selectedRoleId}`, override);
      }
    } catch {
      // ignore for now
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex h-[520px] w-[640px] flex-col rounded-xl bg-bg-sidebar shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-text-primary">Channel Permissions</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-bg-content hover:text-text-primary"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Role list */}
          <div className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-2">
            {roles.map((role) => {
              const hasOverride = overrides[role.id] != null;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                    selectedRoleId === role.id
                      ? "bg-bg-content text-text-primary"
                      : "text-text-secondary hover:bg-bg-content/50 hover:text-text-primary"
                  }`}
                >
                  <span style={role.color ? { color: role.color } : undefined}>{role.name}</span>
                  {hasOverride && (
                    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
            {roles.length === 0 && (
              <p className="px-3 py-2 text-xs text-text-muted">No roles</p>
            )}
          </div>

          {/* Permission grid */}
          <div className="flex flex-1 flex-col overflow-y-auto p-4">
            {selectedOverride && (
              <div className="flex flex-col gap-1">
                {CHANNEL_PERMISSIONS.map(({ key, label, bit }) => {
                  const state = getOverrideState(selectedOverride.allow, selectedOverride.deny, bit);
                  return (
                    <button
                      key={key}
                      onClick={() => togglePermission(bit)}
                      className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-content"
                    >
                      <span>{label}</span>
                      <OverrideBadge state={state} />
                    </button>
                  );
                })}
              </div>
            )}
            {!selectedRoleId && (
              <p className="text-sm text-text-muted">Select a role to configure overrides.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function OverrideBadge({ state }: { state: OverrideState }) {
  if (state === "allow") {
    return (
      <span className="flex h-5 w-14 items-center justify-center rounded bg-green-600/20 text-xs font-medium text-green-400">
        Allow
      </span>
    );
  }
  if (state === "deny") {
    return (
      <span className="flex h-5 w-14 items-center justify-center rounded bg-red-600/20 text-xs font-medium text-red-400">
        Deny
      </span>
    );
  }
  return (
    <span className="flex h-5 w-14 items-center justify-center rounded bg-bg-content text-xs font-medium text-text-muted">
      &mdash;
    </span>
  );
}
