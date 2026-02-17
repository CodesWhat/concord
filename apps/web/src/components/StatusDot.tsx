import type { UserStatus } from "@concord/shared";

const STATUS_COLORS: Record<UserStatus, string> = {
  online: "#22C55E",
  idle: "#EAB308",
  dnd: "#EF4444",
  offline: "#71717A",
};

export default function StatusDot({
  status,
  className = "",
}: {
  status: UserStatus;
  className?: string;
}) {
  return (
    <span
      className={`block h-3.5 w-3.5 rounded-full border-2 border-bg-deepest ${className}`}
      style={{ backgroundColor: STATUS_COLORS[status] }}
    />
  );
}
