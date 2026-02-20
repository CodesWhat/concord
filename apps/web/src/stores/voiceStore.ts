import { create } from "zustand";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrackPublication,
  LocalTrackPublication,
  type RemoteParticipant,
  type LocalParticipant,
  type Participant,
} from "livekit-client";
import { api } from "../api/client.js";

export interface VoiceParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
}

interface VoiceState {
  currentRoom: Room | null;
  channelId: string | null;
  serverId: string | null;
  channelName: string | null;
  participants: VoiceParticipant[];
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isConnecting: boolean;

  joinChannel: (serverId: string, channelId: string, channelName: string) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  handleVoiceStateUpdate: (data: {
    serverId: string;
    channelId: string;
    userId: string;
    state?: Record<string, unknown>;
  }) => void;
}

function participantToVoice(p: Participant): VoiceParticipant {
  const meta = p.metadata ? JSON.parse(p.metadata) : {};
  const audioPublications = Array.from(p.trackPublications.values()).filter(
    (pub) => pub.kind === Track.Kind.Audio && pub.source === Track.Source.Microphone,
  );
  const videoPublications = Array.from(p.trackPublications.values()).filter(
    (pub) => pub.kind === Track.Kind.Video && pub.source === Track.Source.Camera,
  );
  const screenPublications = Array.from(p.trackPublications.values()).filter(
    (pub) => pub.source === Track.Source.ScreenShare,
  );

  return {
    userId: meta.userId ?? p.identity,
    username: meta.username ?? p.identity,
    displayName: meta.displayName ?? p.name ?? p.identity,
    avatarUrl: meta.avatarUrl ?? null,
    isMuted: audioPublications.length === 0 || audioPublications.every((pub) => pub.isMuted),
    isDeafened: false,
    isVideoOn: videoPublications.some((pub) => !pub.isMuted),
    isScreenSharing: screenPublications.length > 0,
    isSpeaking: p.isSpeaking,
  };
}

function collectParticipants(room: Room): VoiceParticipant[] {
  const participants: VoiceParticipant[] = [];
  if (room.localParticipant) {
    participants.push(participantToVoice(room.localParticipant));
  }
  for (const p of room.remoteParticipants.values()) {
    participants.push(participantToVoice(p));
  }
  return participants;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  currentRoom: null,
  channelId: null,
  serverId: null,
  channelName: null,
  participants: [],
  isMuted: false,
  isDeafened: false,
  isVideoOn: false,
  isScreenSharing: false,
  isConnecting: false,

  joinChannel: async (serverId: string, channelId: string, channelName: string) => {
    const state = get();

    // If already in a room, disconnect first
    if (state.currentRoom) {
      await get().leaveChannel();
    }

    set({ isConnecting: true });

    try {
      const { token, url } = await api.post<{ token: string; url: string }>(
        `/api/v1/servers/${serverId}/channels/${channelId}/voice/join`,
      );

      const room = new Room();

      const refreshParticipants = () => {
        set({ participants: collectParticipants(room) });
      };

      room.on(RoomEvent.ParticipantConnected, refreshParticipants);
      room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
      room.on(RoomEvent.TrackMuted, refreshParticipants);
      room.on(RoomEvent.TrackUnmuted, refreshParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
      room.on(RoomEvent.TrackSubscribed, refreshParticipants);
      room.on(RoomEvent.TrackUnsubscribed, refreshParticipants);
      room.on(RoomEvent.TrackPublished, refreshParticipants);
      room.on(RoomEvent.TrackUnpublished, refreshParticipants);
      room.on(RoomEvent.LocalTrackPublished, refreshParticipants);
      room.on(RoomEvent.LocalTrackUnpublished, refreshParticipants);
      room.on(RoomEvent.Disconnected, () => {
        set({
          currentRoom: null,
          channelId: null,
          serverId: null,
          channelName: null,
          participants: [],
          isMuted: false,
          isDeafened: false,
          isVideoOn: false,
          isScreenSharing: false,
        });
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      set({
        currentRoom: room,
        channelId,
        serverId,
        channelName,
        participants: collectParticipants(room),
        isConnecting: false,
        isMuted: false,
        isDeafened: false,
        isVideoOn: false,
        isScreenSharing: false,
      });
    } catch (err) {
      set({ isConnecting: false });
      throw err;
    }
  },

  leaveChannel: async () => {
    const { currentRoom, serverId, channelId } = get();

    if (currentRoom) {
      currentRoom.disconnect();
    }

    if (serverId && channelId) {
      try {
        await api.post(`/api/v1/servers/${serverId}/channels/${channelId}/voice/leave`);
      } catch {
        // best-effort
      }
    }

    set({
      currentRoom: null,
      channelId: null,
      serverId: null,
      channelName: null,
      participants: [],
      isMuted: false,
      isDeafened: false,
      isVideoOn: false,
      isScreenSharing: false,
    });
  },

  toggleMute: () => {
    const { currentRoom, isMuted } = get();
    if (!currentRoom) return;

    const newMuted = !isMuted;
    currentRoom.localParticipant.setMicrophoneEnabled(!newMuted);
    set({ isMuted: newMuted });
  },

  toggleDeafen: () => {
    const { currentRoom, isDeafened } = get();
    if (!currentRoom) return;

    const newDeafened = !isDeafened;
    for (const p of currentRoom.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        if (pub.kind === Track.Kind.Audio && pub.track) {
          pub.track.mediaStreamTrack.enabled = !newDeafened;
        }
      }
    }

    // Also mute mic when deafening
    if (newDeafened) {
      currentRoom.localParticipant.setMicrophoneEnabled(false);
      set({ isDeafened: true, isMuted: true });
    } else {
      set({ isDeafened: false });
    }
  },

  toggleVideo: async () => {
    const { currentRoom, isVideoOn } = get();
    if (!currentRoom) return;

    const newVideoOn = !isVideoOn;
    await currentRoom.localParticipant.setCameraEnabled(newVideoOn);
    set({ isVideoOn: newVideoOn });
  },

  toggleScreenShare: async () => {
    const { currentRoom, isScreenSharing } = get();
    if (!currentRoom) return;

    const newScreenSharing = !isScreenSharing;
    await currentRoom.localParticipant.setScreenShareEnabled(newScreenSharing);
    set({ isScreenSharing: newScreenSharing });
  },

  handleVoiceStateUpdate: (data) => {
    const { channelId, currentRoom } = get();
    // If this update is for our current channel, refresh participants
    if (currentRoom && data.channelId === channelId) {
      set({ participants: collectParticipants(currentRoom) });
    }
  },
}));
