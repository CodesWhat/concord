import { useState } from "react";
import { useServerStore } from "../stores/serverStore";
import { useChannelStore } from "../stores/channelStore";
import { useMessageStore } from "../stores/messageStore";

function ServerIcon({
  server,
  isSelected,
  onClick,
}: {
  server: { id: string; name: string };
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isRounded = hovered || isSelected;
  const initial = server.name.charAt(0).toUpperCase();

  return (
    <div className="relative flex items-center justify-center py-1">
      {isSelected && (
        <span className="absolute left-0 h-10 w-1 rounded-r-sm bg-text-primary" />
      )}

      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex h-12 w-12 items-center justify-center text-lg font-semibold transition-all duration-200"
        style={{
          borderRadius: isRounded ? "16px" : "24px",
          backgroundColor: isSelected ? "#7C3AED" : "#232330",
          color: isSelected ? "#fff" : "#A1A1AA",
        }}
        title={server.name}
      >
        {initial}
      </button>
    </div>
  );
}

function RailDivider() {
  return <div className="mx-auto my-1 h-px w-8 bg-border" />;
}

export default function ServerRail() {
  const servers = useServerStore((s) => s.servers);
  const selectedServerId = useServerStore((s) => s.selectedServerId);
  const selectServer = useServerStore((s) => s.selectServer);
  const fetchMembers = useServerStore((s) => s.fetchMembers);
  const fetchChannels = useChannelStore((s) => s.fetchChannels);
  const createServer = useServerStore((s) => s.createServer);

  const handleSelectServer = (id: string) => {
    selectServer(id);
    fetchChannels(id);
    fetchMembers(id);
  };

  const handleAddServer = () => {
    const name = window.prompt("Server name:");
    if (name?.trim()) {
      createServer(name.trim());
    }
  };

  return (
    <nav className="hidden md:flex flex-col items-center w-[72px] min-w-[72px] bg-bg-deepest py-3 overflow-y-auto scrollbar-thin">
      <button
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white transition-all duration-200 hover:rounded-[16px]"
        title="Home"
      >
        C
      </button>

      <RailDivider />

      <div className="relative py-1">
        <button
          className="flex h-12 w-12 items-center justify-center rounded-3xl bg-bg-elevated text-text-secondary transition-all duration-200 hover:rounded-[16px] hover:bg-primary hover:text-white"
          title="Direct Messages"
        >
          <DmIcon />
        </button>
      </div>

      <RailDivider />

      <div className="flex flex-col items-center gap-0.5">
        {servers.map((s) => (
          <ServerIcon
            key={s.id}
            server={s}
            isSelected={s.id === selectedServerId}
            onClick={() => handleSelectServer(s.id)}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-1 pt-2">
        <RailDivider />
        <button
          onClick={handleAddServer}
          className="flex h-12 w-12 items-center justify-center rounded-3xl bg-bg-elevated text-2xl text-green-500 transition-all duration-200 hover:rounded-[16px] hover:bg-green-500 hover:text-white"
          title="Add a Server"
        >
          +
        </button>
        <button
          className="flex h-12 w-12 items-center justify-center rounded-3xl bg-bg-elevated text-text-secondary transition-all duration-200 hover:rounded-[16px] hover:bg-green-500 hover:text-white"
          title="Explore Servers"
        >
          <CompassIcon />
        </button>
      </div>
    </nav>
  );
}

function DmIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" />
    </svg>
  );
}
