import { useState, useEffect } from "react";
import { useServerStore } from "../stores/serverStore";
import PermissionMatrix from "./PermissionMatrix";

interface RoleEditorProps {
  serverId: string;
}

const COLOR_PALETTE = [
  "#E74C3C",
  "#E91E63",
  "#9B59B6",
  "#3498DB",
  "#1ABC9C",
  "#2ECC71",
  "#F1C40F",
  "#E67E22",
];

export default function RoleEditor({ serverId }: RoleEditorProps) {
  const roles = useServerStore((s) => s.roles);
  const fetchRoles = useServerStore((s) => s.fetchRoles);
  const createRole = useServerStore((s) => s.createRole);
  const updateRole = useServerStore((s) => s.updateRole);
  const deleteRole = useServerStore((s) => s.deleteRole);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editPermissions, setEditPermissions] = useState(0);
  const [editMentionable, setEditMentionable] = useState(false);
  const [editHoisted, setEditHoisted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetchRoles(serverId);
  }, [serverId, fetchRoles]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  useEffect(() => {
    if (selectedRole) {
      setEditName(selectedRole.name);
      setEditColor(selectedRole.color ?? "");
      setEditPermissions(selectedRole.permissions);
      setEditMentionable(selectedRole.mentionable);
      setEditHoisted(selectedRole.hoisted);
      setConfirmDelete(false);
    }
  }, [selectedRole]);

  const sortedRoles = [...roles].sort((a, b) => b.position - a.position);

  const handleCreate = async () => {
    const role = await createRole(serverId, "New Role");
    if (role) {
      setSelectedRoleId(role.id);
    }
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    await updateRole(serverId, selectedRoleId, {
      name: editName.trim(),
      color: editColor || null,
      permissions: editPermissions,
      mentionable: editMentionable,
      hoisted: editHoisted,
    });
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedRoleId) return;
    await deleteRole(serverId, selectedRoleId);
    setSelectedRoleId(null);
  };

  return (
    <div className="flex flex-1 gap-4 overflow-hidden">
      {/* Role list */}
      <div className="flex w-40 flex-shrink-0 flex-col">
        <div className="flex-1 overflow-y-auto">
          {sortedRoles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                role.id === selectedRoleId
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-secondary hover:bg-bg-content"
              }`}
            >
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: role.color ?? "#99AAB5" }}
              />
              <span className="truncate">{role.name}</span>
            </button>
          ))}
        </div>
        <button
          onClick={handleCreate}
          className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/80"
        >
          Create Role
        </button>
      </div>

      {/* Role editor */}
      {selectedRole ? (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4">
            {/* Name */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Role Name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg bg-bg-deepest px-3 py-2 text-sm text-text-primary outline-none"
              />
            </div>

            {/* Color */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Color
              </label>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={`h-6 w-6 rounded-full border-2 ${
                        editColor === color ? "border-white" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder="#HEX"
                  className="w-20 rounded-lg bg-bg-deepest px-2 py-1 text-xs text-text-primary outline-none"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={editMentionable}
                  onChange={(e) => setEditMentionable(e.target.checked)}
                  className="accent-primary h-3.5 w-3.5"
                />
                Mentionable
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={editHoisted}
                  onChange={(e) => setEditHoisted(e.target.checked)}
                  className="accent-primary h-3.5 w-3.5"
                />
                Show separately
              </label>
            </div>

            {/* Permissions */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Permissions
              </label>
              <PermissionMatrix
                permissions={editPermissions}
                onChange={setEditPermissions}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-border pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/80 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Delete Role
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDelete}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                  >
                    Confirm Delete
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
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
          Select a role to edit
        </div>
      )}
    </div>
  );
}
