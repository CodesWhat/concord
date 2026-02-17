import { Permissions, hasPermission, addPermission, removePermission } from "@concord/shared";

interface PermissionMatrixProps {
  permissions: number;
  onChange: (permissions: number) => void;
  disabled?: boolean;
}

const PERMISSION_GROUPS = [
  {
    name: "General",
    perms: [
      { key: "MANAGE_SERVER", label: "Manage Server" },
      { key: "MANAGE_CHANNELS", label: "Manage Channels" },
      { key: "MANAGE_ROLES", label: "Manage Roles" },
      { key: "VIEW_AUDIT_LOG", label: "View Audit Log" },
    ],
  },
  {
    name: "Members",
    perms: [
      { key: "KICK_MEMBERS", label: "Kick Members" },
      { key: "BAN_MEMBERS", label: "Ban Members" },
      { key: "CREATE_INVITES", label: "Create Invites" },
    ],
  },
  {
    name: "Text",
    perms: [
      { key: "SEND_MESSAGES", label: "Send Messages" },
      { key: "READ_MESSAGES", label: "Read Messages" },
      { key: "MANAGE_MESSAGES", label: "Manage Messages" },
      { key: "EMBED_LINKS", label: "Embed Links" },
      { key: "ATTACH_FILES", label: "Attach Files" },
      { key: "MENTION_EVERYONE", label: "Mention Everyone" },
      { key: "ADD_REACTIONS", label: "Add Reactions" },
    ],
  },
  {
    name: "Threads",
    perms: [
      { key: "MANAGE_THREADS", label: "Manage Threads" },
      { key: "SEND_MESSAGES_THREADS", label: "Send in Threads" },
    ],
  },
  {
    name: "Voice",
    perms: [
      { key: "CONNECT_VOICE", label: "Connect" },
      { key: "SPEAK", label: "Speak" },
      { key: "MUTE_MEMBERS", label: "Mute Members" },
      { key: "DEAFEN_MEMBERS", label: "Deafen Members" },
      { key: "MOVE_MEMBERS", label: "Move Members" },
      { key: "USE_VOICE_ACTIVITY", label: "Voice Activity" },
      { key: "STREAM", label: "Stream" },
    ],
  },
  {
    name: "Advanced",
    perms: [
      { key: "MANAGE_WEBHOOKS", label: "Manage Webhooks" },
      { key: "MANAGE_EMOJIS", label: "Manage Emojis" },
      { key: "ADMINISTRATOR", label: "Administrator" },
    ],
  },
] as const;

export default function PermissionMatrix({ permissions, onChange, disabled }: PermissionMatrixProps) {
  const toggle = (key: keyof typeof Permissions) => {
    const perm = Permissions[key];
    if (hasPermission(permissions, perm) && !(key !== "ADMINISTRATOR" && (permissions & Permissions.ADMINISTRATOR) !== 0)) {
      onChange(removePermission(permissions, perm));
    } else {
      onChange(addPermission(permissions, perm));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.name}>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {group.name}
          </h4>
          <div className="flex flex-col gap-1">
            {group.perms.map(({ key, label }) => {
              const permValue = Permissions[key];
              const checked = (permissions & permValue) !== 0;
              return (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-bg-content"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    disabled={disabled}
                    className="accent-primary h-3.5 w-3.5"
                  />
                  <span>{label}</span>
                  {key === "ADMINISTRATOR" && (
                    <span className="ml-auto text-xs text-yellow-500">
                      Grants all permissions. Use with caution.
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
