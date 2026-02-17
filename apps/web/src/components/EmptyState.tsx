import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  heading: string;
  subtext?: string;
}

export default function EmptyState({ icon, heading, subtext }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-elevated text-text-muted">
        {icon}
      </div>
      <p className="mt-3 text-sm font-medium text-text-secondary">{heading}</p>
      {subtext && (
        <p className="mt-1 text-xs text-text-muted">{subtext}</p>
      )}
    </div>
  );
}
