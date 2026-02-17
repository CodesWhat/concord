interface BadgeProps {
  count: number;
  max?: number;
}

function Badge({ count, max = 99 }: BadgeProps) {
  if (count <= 0) return null;

  const display = count > max ? `${max}+` : String(count);

  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
      {display}
    </span>
  );
}

export { Badge, type BadgeProps };
