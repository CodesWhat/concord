import { useNavigate, useLocation } from "react-router";
import { useSearchStore } from "../stores/searchStore.js";

export default function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const openSearch = useSearchStore((s) => s.open);

  const isDms = location.pathname === "/dms";
  const isHome = location.pathname === "/app";

  const handleSearchTab = () => {
    openSearch();
  };

  return (
    <nav className="flex md:hidden h-14 items-center justify-around border-t border-border bg-bg-deepest">
      <TabButton icon={<HomeIcon />} label="Home" active={isHome} onClick={() => navigate("/app")} />
      <TabButton icon={<DmIcon />} label="DMs" active={isDms} onClick={() => navigate("/dms")} />
      <TabButton icon={<ActivityIcon />} label="Activity" active={false} onClick={() => {}} />
      <TabButton icon={<SearchIcon />} label="Search" active={false} onClick={handleSearchTab} />
      <TabButton icon={<ProfileIcon />} label="Profile" active={false} onClick={() => {}} />
    </nav>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button onClick={onClick} className="relative flex flex-col items-center gap-0.5 px-3 py-1 focus-visible:ring-2 focus-visible:ring-primary/50 outline-none">
      <span className={active ? "text-primary" : "text-text-muted"}>
        {icon}
      </span>
      <span
        className={`text-[10px] font-medium ${active ? "text-primary" : "text-text-muted"}`}
      >
        {label}
      </span>
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── SVG icons ───────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function DmIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
