import Redis from "ioredis";
import { AccessToken } from "livekit-server-sdk";
import { config } from "../config.js";
import { dispatchToServer, GatewayEvent } from "../gateway/index.js";
import type { ServiceResult } from "@concord/shared";

const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });

export interface VoiceState {
  muted: boolean;
  deafened: boolean;
  video: boolean;
  streaming: boolean;
  joinedAt: string;
}

export interface VoiceChannelState {
  channelId: string;
  users: Record<string, VoiceState>;
}

function voiceKey(serverId: string, channelId: string): string {
  return `voice:${serverId}:${channelId}`;
}

export async function generateToken(
  userId: string,
  serverId: string,
  channelId: string,
): Promise<ServiceResult<string>> {
  if (!config.livekit.apiKey || !config.livekit.apiSecret) {
    return {
      data: null,
      error: { code: "VOICE_UNAVAILABLE", message: "LiveKit is not configured", statusCode: 503 },
    };
  }

  const roomName = `server:${serverId}:channel:${channelId}`;
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: userId,
    ttl: "6h",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return { data: token, error: null };
}

export async function joinVoiceChannel(
  userId: string,
  serverId: string,
  channelId: string,
): Promise<ServiceResult<{ token: string; url: string }>> {
  const tokenResult = await generateToken(userId, serverId, channelId);
  if (tokenResult.error) {
    return { data: null, error: tokenResult.error };
  }

  const state: VoiceState = {
    muted: false,
    deafened: false,
    video: false,
    streaming: false,
    joinedAt: new Date().toISOString(),
  };

  await redis.hset(voiceKey(serverId, channelId), userId, JSON.stringify(state));

  dispatchToServer(serverId, GatewayEvent.VOICE_STATE_UPDATE, {
    serverId,
    channelId,
    userId,
    ...state,
  });

  return {
    data: { token: tokenResult.data!, url: config.livekit.clientUrl },
    error: null,
  };
}

export async function leaveVoiceChannel(
  userId: string,
  serverId: string,
  channelId: string,
): Promise<ServiceResult<void>> {
  await redis.hdel(voiceKey(serverId, channelId), userId);

  dispatchToServer(serverId, GatewayEvent.VOICE_STATE_UPDATE, {
    serverId,
    channelId,
    userId,
    left: true,
  });

  return { data: undefined as void, error: null };
}

export async function getVoiceStates(
  serverId: string,
): Promise<ServiceResult<VoiceChannelState[]>> {
  const pattern = `voice:${serverId}:*`;
  const keys = await redis.keys(pattern);
  const result: VoiceChannelState[] = [];

  for (const key of keys) {
    const channelId = key.split(":")[2]!;
    const entries = await redis.hgetall(key);
    const users: Record<string, VoiceState> = {};
    for (const [uid, stateJson] of Object.entries(entries)) {
      users[uid] = JSON.parse(stateJson);
    }
    if (Object.keys(users).length > 0) {
      result.push({ channelId, users });
    }
  }

  return { data: result, error: null };
}

export async function disconnectUser(userId: string): Promise<void> {
  const pattern = "voice:*";
  const keys = await redis.keys(pattern);

  for (const key of keys) {
    const removed = await redis.hdel(key, userId);
    if (removed > 0) {
      // key format: voice:{serverId}:{channelId}
      const parts = key.split(":");
      const serverId = parts[1]!;
      const channelId = parts[2]!;

      dispatchToServer(serverId, GatewayEvent.VOICE_STATE_UPDATE, {
        serverId,
        channelId,
        userId,
        left: true,
      });
    }
  }
}
