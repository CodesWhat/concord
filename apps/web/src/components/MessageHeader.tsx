import { useSearchStore } from "../stores/searchStore.js";

export default function MessageHeader({
  channelName,
  topic,
  onToggleMembers,
  membersVisible,
}: {
  channelName: string;
  topic?: string;
  onToggleMembers: () => void;
  membersVisible: boolean;
}) {
  const openSearch = useSearchStore((s) => s.open);
  return (
    <div className="flex h-12 items-center border-b border-border px-4">
      <div className="flex items-center gap-2">
        <HashIcon />
        <span className="font-semibold text-text-primary">{channelName}</span>
        {topic && (
          <>
            <span className="mx-2 h-6 w-px bg-border" />
            <span className="truncate text-sm text-text-muted">{topic}</span>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <HeaderIconButton title="Search (Ctrl+F)" onClick={openSearch}><SearchIcon /></HeaderIconButton>
        <HeaderIconButton title="Pinned Messages"><PinIcon /></HeaderIconButton>
        <HeaderIconButton
          title="Toggle Members"
          active={membersVisible}
          onClick={onToggleMembers}
        >
          <MembersIcon />
        </HeaderIconButton>
        <HeaderIconButton title="Inbox"><InboxIcon /></HeaderIconButton>
      </div>
    </div>
  );
}

function HeaderIconButton({
  children,
  title,
  active,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 outline-none ${
        active
          ? "text-text-primary bg-bg-elevated"
          : "text-text-muted hover:text-text-secondary hover:bg-bg-elevated"
      }`}
    >
      {children}
    </button>
  );
}

// ── SVG icons ───────────────────────────────────────────────────────

function HashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-text-muted">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 17v5" /><path d="M9 2h6l-1 7h4l-7 8V10H7l2-8z" />
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
