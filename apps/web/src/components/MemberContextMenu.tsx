import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useServerStore } from "../stores/serverStore.js";
import { useAuthStore } from "../stores/authStore.js";
import { useDmStore } from "../stores/dmStore.js";
import { hasPermission, Permissions } from "@concord/shared";

interface MemberContextMenuProps {
  userId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function MemberContextMenu({ userId, position, onClose }: MemberContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const openDm = useDmStore((s) => s.openDm);
  const selectedServerId = useServerStore((s) => s.selectedServerId);
  const servers = useServerStore((s) => s.servers);
  const members = useServerStore((s) => s.members);
  const roles = useServerStore((s) => s.roles);
  const kickMember = useServerStore((s) => s.kickMember);
  const banMember = useServerStore((s) => s.banMember);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [showKickConfirm, setShowKickConfirm] = useState(false);

  const server = servers.find((s) => s.id === selectedServerId);
  const isOwner = server?.ownerId === currentUserId;
  const targetMember = members.find((m) => m.userId === userId);
  const isSelf = currentUserId === userId;
  const isTargetOwner = server?.ownerId === userId;

  // Compute current user's permissions from their roles
  const currentMember = members.find((m) => m.userId === currentUserId);
  const myPermissions = isOwner
    ? 0x7FFFFFFF
    : (currentMember?.roles ?? []).reduce((perms, memberRole) => {
        const role = roles.find((r) => r.id === memberRole.id);
        return perms | (role?.permissions ?? 0);
      }, 0);

  const canKick = hasPermission(myPermissions, Permissions.KICK_MEMBERS);
  const canBan = hasPermission(myPermissions, Permissions.BAN_MEMBERS);
  const showActions = !isSelf && !isTargetOwner && (canKick || canBan);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Position adjustment to keep menu in viewport
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200),
    y: Math.min(position.y, window.innerHeight - 120),
  };

  const handleMessage = async () => {
    onClose();
    const channelId = await openDm(userId);
    if (channelId) {
      navigate("/dms");
    }
  };

  // Show menu if there are moderation actions OR we can message the user (not self)
  if (!showActions && isSelf) return null;

  const handleKick = async () => {
    if (!selectedServerId) return;
    await kickMember(selectedServerId, userId);
    onClose();
  };

  const handleBan = async () => {
    if (!selectedServerId) return;
    await banMember(selectedServerId, userId, banReason || undefined);
    onClose();
  };

  // Ban dialog overlay
  if (showBanDialog) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 animate-fade-in" onClick={() => setShowBanDialog(false)}>
        <div className="w-full max-w-sm rounded-xl bg-bg-sidebar p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-text-primary mb-2">Ban Member</h3>
          <p className="text-sm text-text-muted mb-4">
            Ban <span className="font-semibold text-text-secondary">{targetMember?.user.displayName ?? "this user"}</span> from the server? They will not be able to rejoin.
          </p>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Reason (optional)
          </label>
          <input
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Reason for ban..."
            className="w-full rounded-lg bg-bg-deepest px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted mb-4"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowBanDialog(false)}
              className="rounded-lg px-4 py-2 text-sm text-text-muted hover:text-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleBan}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Ban
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Kick confirmation overlay
  if (showKickConfirm) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 animate-fade-in" onClick={() => setShowKickConfirm(false)}>
        <div className="w-full max-w-sm rounded-xl bg-bg-sidebar p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-text-primary mb-2">Kick Member</h3>
          <p className="text-sm text-text-muted mb-4">
            Kick <span className="font-semibold text-text-secondary">{targetMember?.user.displayName ?? "this user"}</span> from the server? They can rejoin with an invite.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowKickConfirm(false)}
              className="rounded-lg px-4 py-2 text-sm text-text-muted hover:text-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleKick}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Kick
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] min-w-[160px] rounded-lg bg-bg-sidebar border border-border shadow-xl py-1 animate-scale-in"
      style={{ top: adjustedPosition.y, left: adjustedPosition.x }}
    >
      {!isSelf && (
        <button
          onClick={handleMessage}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary text-left"
        >
          Message
        </button>
      )}
      {showActions && <div className="my-1 h-px bg-border" />}
      {canKick && (
        <button
          onClick={() => setShowKickConfirm(true)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-bg-elevated hover:text-red-300 text-left"
        >
          Kick
        </button>
      )}
      {canBan && (
        <button
          onClick={() => setShowBanDialog(true)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-bg-elevated hover:text-red-300 text-left"
        >
          Ban
        </button>
      )}
    </div>
  );
}
