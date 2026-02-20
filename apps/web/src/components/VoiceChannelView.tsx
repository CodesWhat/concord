import { useVoiceStore } from "../stores/voiceStore.js";
import VideoGrid from "./VideoGrid.js";

export default function VoiceChannelView() {
  const channelName = useVoiceStore((s) => s.channelName);
  const participants = useVoiceStore((s) => s.participants);
  const channelId = useVoiceStore((s) => s.channelId);

  if (!channelId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-w-0">
        <NotConnectedIcon />
        <p className="mt-3 text-sm font-medium text-text-secondary">
          Not connected to a voice channel
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Join a voice channel from the sidebar to start talking
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex h-12 items-center border-b border-border px-4">
        <div className="flex items-center gap-2">
          <SpeakerIcon />
          <span className="font-semibold text-text-primary">
            {channelName}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-text-muted">
            {participants.length} {participants.length === 1 ? "user" : "users"}
          </span>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 min-h-0 bg-bg-deepest">
        <VideoGrid />
      </div>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="text-text-muted"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function NotConnectedIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-elevated text-text-muted">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    </div>
  );
}
