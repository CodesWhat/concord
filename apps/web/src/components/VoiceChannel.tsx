import { useVoiceStore, type VoiceParticipant } from "../stores/voiceStore.js";
import { SpeakerIcon } from "./ChannelSidebarIcons.js";
import { getAvatarColor } from "../utils/colors.js";

interface VoiceChannelProps {
  channel: { id: string; name: string; type: string };
  isActive: boolean;
  onJoin: () => void;
}

function MutedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-red-400">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function DeafenedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-red-400">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ParticipantRow({ participant }: { participant: VoiceParticipant }) {
  const colors = getAvatarColor(participant.userId);

  return (
    <div className="flex items-center gap-1.5 rounded-md px-2 py-0.5">
      {participant.avatarUrl ? (
        <img
          src={participant.avatarUrl}
          alt=""
          className={`h-5 w-5 rounded-full object-cover ${participant.isSpeaking ? "ring-2 ring-green-500" : ""}`}
        />
      ) : (
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${participant.isSpeaking ? "ring-2 ring-green-500" : ""}`}
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {participant.displayName.charAt(0)}
        </div>
      )}
      <span className="flex-1 truncate text-xs text-text-muted">
        {participant.displayName}
      </span>
      {participant.isDeafened && <DeafenedIcon />}
      {participant.isMuted && !participant.isDeafened && <MutedIcon />}
    </div>
  );
}

export default function VoiceChannel({ channel, isActive, onJoin }: VoiceChannelProps) {
  const channelId = useVoiceStore((s) => s.channelId);
  const participants = useVoiceStore((s) => s.participants);
  const isConnecting = useVoiceStore((s) => s.isConnecting);

  const isConnectedHere = channelId === channel.id;
  const displayParticipants = isConnectedHere ? participants : [];

  return (
    <div>
      <button
        onClick={onJoin}
        disabled={isConnecting}
        className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 outline-none ${
          isActive
            ? "bg-bg-elevated text-text-primary"
            : "text-text-muted hover:text-text-secondary hover:bg-bg-elevated/50"
        }`}
      >
        <SpeakerIcon />
        <span className={`truncate ${isConnectedHere ? "text-green-400" : ""}`}>
          {channel.name}
        </span>
        {isConnecting && channelId === null && (
          <span className="ml-auto">
            <div className="h-3 w-3 animate-spin rounded-full border border-text-muted border-t-transparent" />
          </span>
        )}
      </button>
      {displayParticipants.length > 0 && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5">
          {displayParticipants.map((p) => (
            <ParticipantRow key={p.userId} participant={p} />
          ))}
        </div>
      )}
    </div>
  );
}
