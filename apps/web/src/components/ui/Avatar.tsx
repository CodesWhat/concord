type AvatarSize = "sm" | "md" | "lg";
type StatusType = "online" | "idle" | "dnd" | "offline";

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: StatusType;
}

const sizeMap: Record<AvatarSize, { container: string; text: string; dot: string }> = {
  sm: { container: "h-8 w-8", text: "text-xs", dot: "h-2.5 w-2.5 -bottom-0.5 -right-0.5" },
  md: { container: "h-10 w-10", text: "text-sm", dot: "h-3 w-3 -bottom-0.5 -right-0.5" },
  lg: { container: "h-12 w-12", text: "text-base", dot: "h-3.5 w-3.5 -bottom-0.5 -right-0.5" },
};

const statusColors: Record<StatusType, string> = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-zinc-500",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ src, alt, name, size = "md", status }: AvatarProps) {
  const s = sizeMap[size];

  return (
    <div className={`relative inline-flex shrink-0 ${s.container}`}>
      {src ? (
        <img
          src={src}
          alt={alt ?? name ?? ""}
          className={`${s.container} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${s.container} flex items-center justify-center rounded-full bg-primary/20 text-primary-light font-medium ${s.text}`}
          aria-label={alt ?? name}
        >
          {name ? getInitials(name) : "?"}
        </div>
      )}
      {status && (
        <span
          className={`absolute ${s.dot} rounded-full border-2 border-bg-sidebar ${statusColors[status]}`}
          aria-label={status}
        />
      )}
    </div>
  );
}

export { Avatar, type AvatarProps, type AvatarSize, type StatusType };
