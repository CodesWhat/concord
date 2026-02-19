import { useState, useCallback } from "react";
import { useServerStore } from "../stores/serverStore";
import { usePresenceStore } from "../stores/presenceStore";
import type { UserStatus } from "@concord/shared";
import StatusDot from "./StatusDot";
import UserProfileCard from "./UserProfileCard.js";
import MemberContextMenu from "./MemberContextMenu.js";
import { getAvatarColor } from "../utils/colors.js";

interface MemberDisplay {
  userId: string;
  displayName: string;
  status: UserStatus;
  roleColor: string | null;
}

function MemberItem({ member, onClickMember, onContextMenu }: { member: MemberDisplay; onClickMember: (userId: string, rect: DOMRect) => void; onContextMenu: (userId: string, x: number, y: number) => void }) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onClickMember(member.userId, rect);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onContextMenu(member.userId, e.clientX, e.clientY);
  };

  return (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className="group flex w-full items-center gap-3 rounded-md border-l-2 border-transparent px-2 py-1.5 transition-colors duration-150 hover:border-primary hover:bg-bg-elevated text-left focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
    >
      <div className="relative shrink-0">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
          style={{ backgroundColor: getAvatarColor(member.userId).bg, color: getAvatarColor(member.userId).text }}
        >
          {member.displayName.charAt(0)}
        </div>
        <StatusDot
          status={member.status}
          className="absolute -bottom-0.5 -right-0.5 !h-3 !w-3 !border-bg-sidebar"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-sm font-medium"
          style={{ color: member.roleColor ?? "#F5F5F7" }}
        >
          {member.displayName}
        </div>
      </div>
    </button>
  );
}

function MemberGroup({
  label,
  count,
  members: memberList,
  onClickMember,
  onContextMenu,
}: {
  label: string;
  count: number;
  members: MemberDisplay[];
  onClickMember: (userId: string, rect: DOMRect) => void;
  onContextMenu: (userId: string, x: number, y: number) => void;
}) {
  return (
    <div className="mb-4">
      <h3 className="px-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {label} &mdash; {count}
      </h3>
      <div className="flex flex-col gap-0.5">
        {memberList.map((m) => (
          <MemberItem key={m.userId} member={m} onClickMember={onClickMember} onContextMenu={onContextMenu} />
        ))}
      </div>
    </div>
  );
}

export default function MemberSidebar() {
  const members = useServerStore((s) => s.members);
  const presenceStatuses = usePresenceStore((s) => s.statuses);
  const [profileCard, setProfileCard] = useState<{ userId: string; rect: DOMRect } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ userId: string; x: number; y: number } | null>(null);

  const handleClickMember = useCallback((userId: string, rect: DOMRect) => {
    setProfileCard((prev) => prev?.userId === userId ? null : { userId, rect });
  }, []);

  const handleContextMenu = useCallback((userId: string, x: number, y: number) => {
    setContextMenu({ userId, x, y });
  }, []);

  const displayMembers: MemberDisplay[] = members.map((m) => ({
    userId: m.userId,
    displayName: m.user.displayName,
    status: (presenceStatuses[m.userId] ?? m.user.status) as UserStatus,
    roleColor: m.roles[0]?.color ?? null,
  }));

  const online = displayMembers.filter((m) => m.status !== "offline");
  const offline = displayMembers.filter((m) => m.status === "offline");

  if (members.length === 0) {
    return (
      <aside className="hidden lg:flex h-full w-60 min-w-60 flex-col bg-bg-sidebar border-l border-border">
        <div className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin">
          <p className="px-2 text-sm text-text-muted">No members</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex h-full w-60 min-w-60 flex-col bg-bg-sidebar border-l border-border">
      <div className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin">
        {online.length > 0 && (
          <MemberGroup label="Online" count={online.length} members={online} onClickMember={handleClickMember} onContextMenu={handleContextMenu} />
        )}
        {offline.length > 0 && (
          <MemberGroup label="Offline" count={offline.length} members={offline} onClickMember={handleClickMember} onContextMenu={handleContextMenu} />
        )}
      </div>
      {profileCard && (
        <UserProfileCard
          userId={profileCard.userId}
          anchorRect={profileCard.rect}
          onClose={() => setProfileCard(null)}
        />
      )}
      {contextMenu && (
        <MemberContextMenu
          userId={contextMenu.userId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </aside>
  );
}
