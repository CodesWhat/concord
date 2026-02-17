import { useServerStore } from "../stores/serverStore";
import { usePresenceStore } from "../stores/presenceStore";
import type { UserStatus } from "@concord/shared";
import StatusDot from "./StatusDot";
import { getAvatarColor } from "../utils/colors.js";

interface MemberDisplay {
  userId: string;
  displayName: string;
  status: UserStatus;
  roleColor: string | null;
}

function MemberItem({ member }: { member: MemberDisplay }) {
  return (
    <div className="group flex items-center gap-3 rounded-md border-l-2 border-transparent px-2 py-1.5 transition-colors duration-150 hover:border-primary hover:bg-bg-elevated">
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
    </div>
  );
}

function MemberGroup({
  label,
  count,
  members: memberList,
}: {
  label: string;
  count: number;
  members: MemberDisplay[];
}) {
  return (
    <div className="mb-4">
      <h3 className="px-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {label} &mdash; {count}
      </h3>
      <div className="flex flex-col gap-0.5">
        {memberList.map((m) => (
          <MemberItem key={m.userId} member={m} />
        ))}
      </div>
    </div>
  );
}

export default function MemberSidebar() {
  const members = useServerStore((s) => s.members);
  const presenceStatuses = usePresenceStore((s) => s.statuses);

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
          <MemberGroup label="Online" count={online.length} members={online} />
        )}
        {offline.length > 0 && (
          <MemberGroup label="Offline" count={offline.length} members={offline} />
        )}
      </div>
    </aside>
  );
}
