import { useMemo } from "react";
import { Track } from "livekit-client";
import type { Participant } from "livekit-client";
import {
  VideoTrack,
  useTracks,
  useParticipants,
  useIsSpeaking,
  isTrackReference,
} from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { useVoiceStore } from "../stores/voiceStore.js";
import { getAvatarColor } from "../utils/colors.js";

function gridClass(count: number): string {
  if (count <= 1) return "flex items-center justify-center";
  if (count === 2) return "grid grid-cols-2 gap-2";
  if (count <= 4) return "grid grid-cols-2 grid-rows-2 gap-2";
  return "grid gap-2 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]";
}

function ParticipantTile({
  trackRef,
  spotlight,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  spotlight?: boolean;
}) {
  const { participant, source } = trackRef;
  const speaking = useIsSpeaking(participant);
  const hasVideo = isTrackReference(trackRef) && trackRef.publication?.isSubscribed;
  const isMuted = participant.audioTrackPublications.values().next().value?.isMuted ?? true;
  const displayName = participant.name || participant.identity;

  return (
    <div
      className={`relative overflow-hidden rounded-lg border transition-all duration-300 ${
        speaking
          ? "border-primary shadow-[0_0_12px_rgba(124,58,237,0.4)]"
          : "border-border"
      } ${spotlight ? "h-full" : ""}`}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-40 w-full items-center justify-center bg-bg-sidebar">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold"
            style={{
              backgroundColor: getAvatarColor(participant.identity).bg,
              color: getAvatarColor(participant.identity).text,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Username overlay */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-black/60 px-3 py-1.5">
        <span className="truncate text-sm font-medium text-white">
          {displayName}
        </span>
        {source === Track.Source.ScreenShare && (
          <span className="shrink-0 rounded bg-primary/80 px-1.5 py-0.5 text-xs text-white">
            Screen
          </span>
        )}
        {isMuted && (
          <MutedIcon />
        )}
      </div>
    </div>
  );
}

export default function VideoGrid() {
  const room = useVoiceStore((s) => s.currentRoom);

  const cameraTracks = useTracks(
    [Track.Source.Camera],
    { room: room ?? undefined },
  );

  const screenTracks = useTracks(
    [Track.Source.ScreenShare],
    { room: room ?? undefined },
  );

  const participants = useParticipants();

  const allVideoTracks = useMemo(
    () => [...screenTracks, ...cameraTracks],
    [screenTracks, cameraTracks],
  );

  if (!room) return null;

  const hasScreenShare = screenTracks.length > 0;
  const hasAnyVideo = allVideoTracks.length > 0;

  // No video at all -- show voice-connected state
  if (!hasAnyVideo) {
    return <VoiceConnectedState participants={participants} />;
  }

  // Spotlight mode: screen share takes 70%, others in side strip
  const spotlightTrack = screenTracks[0];
  if (hasScreenShare && spotlightTrack) {
    const sideTracks = allVideoTracks.filter(
      (t) =>
        !(
          t.participant.identity === spotlightTrack.participant.identity &&
          t.source === spotlightTrack.source
        ),
    );

    return (
      <div className="flex h-full w-full gap-2 p-2">
        <div className="flex-[7] min-w-0">
          <ParticipantTile trackRef={spotlightTrack} spotlight />
        </div>
        {sideTracks.length > 0 && (
          <div className="flex flex-[3] flex-col gap-2 overflow-y-auto scrollbar-thin">
            {sideTracks.map((t) => (
              <ParticipantTile
                key={`${t.participant.identity}-${t.source}`}
                trackRef={t}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Grid mode
  return (
    <div
      className={`h-full w-full p-2 ${gridClass(allVideoTracks.length)}`}
    >
      {allVideoTracks.map((t) => (
        <div
          key={`${t.participant.identity}-${t.source}`}
          className={
            allVideoTracks.length === 1
              ? "w-[60%] max-w-2xl aspect-video"
              : "aspect-video min-w-0"
          }
        >
          <ParticipantTile trackRef={t} />
        </div>
      ))}
    </div>
  );
}

function VoiceConnectedState({
  participants,
}: {
  participants: Participant[];
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {participants.map((p) => {
          const name = p.name || p.identity;
          return (
            <VoiceAvatar key={p.identity} participant={p} name={name} />
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-text-primary">
          Voice Connected
        </p>
        <p className="text-xs text-text-muted">
          {participants.length} {participants.length === 1 ? "user" : "users"} connected
        </p>
      </div>
      <VoiceWaveform />
    </div>
  );
}

function VoiceAvatar({
  participant,
  name,
}: {
  participant: Participant;
  name: string;
}) {
  const speaking = useIsSpeaking(participant);
  const colors = getAvatarColor(participant.identity);

  return (
    <div
      className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold transition-all duration-300 ${
        speaking
          ? "ring-2 ring-primary ring-offset-2 ring-offset-bg-deepest scale-110"
          : ""
      }`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function VoiceWaveform() {
  return (
    <div className="flex items-end gap-1 h-6">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-primary/60"
          style={{
            animation: `waveform 1.2s ease-in-out ${i * 0.1}s infinite`,
            height: "8px",
          }}
        />
      ))}
      <style>{`
        @keyframes waveform {
          0%, 100% { height: 8px; }
          50% { height: 20px; }
        }
      `}</style>
    </div>
  );
}

function MutedIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0 text-red-400"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.49-.34 2.18" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
