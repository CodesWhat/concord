import { useState, useEffect, useRef } from "react";
import { useVoiceStore } from "../stores/voiceStore.js";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function MicIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function HeadphoneIcon({ deafened }: { deafened: boolean }) {
  if (deafened) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

function VideoIcon({ on }: { on: boolean }) {
  if (on) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ScreenShareIcon({ on }: { on: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={on ? "#22C55E" : "currentColor"} strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

export default function VoicePanel() {
  const channelId = useVoiceStore((s) => s.channelId);
  const channelName = useVoiceStore((s) => s.channelName);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const isVideoOn = useVoiceStore((s) => s.isVideoOn);
  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);
  const toggleVideo = useVoiceStore((s) => s.toggleVideo);
  const toggleScreenShare = useVoiceStore((s) => s.toggleScreenShare);
  const leaveChannel = useVoiceStore((s) => s.leaveChannel);

  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!channelId) return;
    startRef.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [channelId]);

  if (!channelId) return null;

  return (
    <div className="border-t border-border bg-bg-deepest px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-400">Voice Connected</span>
          </div>
          <div className="text-xs text-text-muted truncate">{channelName} — {formatDuration(elapsed)}</div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            isMuted
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
          }`}
        >
          <MicIcon muted={isMuted} />
        </button>
        <button
          onClick={toggleDeafen}
          title={isDeafened ? "Undeafen" : "Deafen"}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            isDeafened
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
          }`}
        >
          <HeadphoneIcon deafened={isDeafened} />
        </button>
        <button
          onClick={() => toggleVideo()}
          title={isVideoOn ? "Turn off camera" : "Turn on camera"}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            isVideoOn
              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              : "text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
          }`}
        >
          <VideoIcon on={isVideoOn} />
        </button>
        <button
          onClick={() => toggleScreenShare()}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            isScreenSharing
              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              : "text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
          }`}
        >
          <ScreenShareIcon on={isScreenSharing} />
        </button>
        <button
          onClick={() => leaveChannel()}
          title="Disconnect"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
        >
          <DisconnectIcon />
        </button>
      </div>
    </div>
  );
}
