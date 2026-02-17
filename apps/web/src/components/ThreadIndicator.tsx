export default function ThreadIndicator({
  thread,
  onClick,
}: {
  thread: { id: string; name: string; messageCount: number };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:underline"
    >
      <ThreadIcon />
      <span>{thread.name}</span>
      <span className="text-text-muted">
        {thread.messageCount} {thread.messageCount === 1 ? "reply" : "replies"}
      </span>
    </button>
  );
}

function ThreadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="10" x2="15" y2="10" />
    </svg>
  );
}
