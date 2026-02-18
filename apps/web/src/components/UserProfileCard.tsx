import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api/client.js";
import { useAuthStore } from "../stores/authStore.js";
import { usePresenceStore } from "../stores/presenceStore.js";
import { useServerStore } from "../stores/serverStore.js";
import { getAvatarColor } from "../utils/colors.js";
import { formatRelativeTime } from "../utils/formatRelative.js";
import StatusDot from "./StatusDot.js";
import type { UserStatus } from "@concord/shared";

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  status: UserStatus;
  createdAt: string;
}

interface UserProfileCardProps {
  userId: string;
  anchorRect: { top: number; left: number; bottom: number; right: number };
  onClose: () => void;
  onEditProfile?: () => void;
}

export default function UserProfileCard({ userId, anchorRect, onClose, onEditProfile }: UserProfileCardProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const presenceStatus = usePresenceStore((s) => s.statuses[userId]);
  const members = useServerStore((s) => s.members);

  const isOwnProfile = currentUserId === userId;

  // Fetch user profile
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<UserProfile>(`/api/v1/users/${userId}`).then((data) => {
      if (!cancelled) {
        setProfile(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Position the card
  const getPosition = useCallback(() => {
    const cardWidth = 320;
    const cardHeight = 360;
    const padding = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = anchorRect.top;
    let left = anchorRect.right + padding;

    // If overflows right, show on left side
    if (left + cardWidth > vw) {
      left = anchorRect.left - cardWidth - padding;
    }
    // If overflows left, fallback to right
    if (left < 0) {
      left = padding;
    }
    // If overflows bottom, shift up
    if (top + cardHeight > vh) {
      top = vh - cardHeight - padding;
    }
    if (top < padding) {
      top = padding;
    }

    return { top, left };
  }, [anchorRect]);

  const pos = getPosition();
  const status = (presenceStatus ?? profile?.status ?? "offline") as UserStatus;

  // Get member roles for this user in the current server
  const member = members.find((m) => m.userId === userId);
  const roles = member?.roles ?? [];

  return (
    <div className="fixed inset-0 z-50">
      <div
        ref={cardRef}
        className="absolute w-80 rounded-lg bg-bg-sidebar border border-border shadow-xl animate-scale-in"
        style={{ top: pos.top, left: pos.left }}
      >
        {/* Banner area */}
        <div className="h-16 rounded-t-lg bg-primary/30" />

        {/* Avatar overlapping banner */}
        <div className="relative px-4">
          <div className="absolute -top-8">
            <div className="relative">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="h-16 w-16 rounded-full border-4 border-bg-sidebar object-cover"
                />
              ) : (
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-bg-sidebar text-xl font-bold"
                  style={{ backgroundColor: getAvatarColor(userId).bg, color: getAvatarColor(userId).text }}
                >
                  {profile?.displayName?.charAt(0) ?? "?"}
                </div>
              )}
              <StatusDot
                status={status}
                className="absolute -bottom-0.5 -right-0.5 !h-4 !w-4 !border-bg-sidebar"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-10 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : profile ? (
            <>
              {/* Name + username */}
              <div className="mb-3">
                <h3 className="text-lg font-bold text-text-primary">{profile.displayName}</h3>
                <p className="text-sm text-text-muted">@{profile.username}</p>
              </div>

              <div className="h-px bg-border mb-3" />

              {/* Bio */}
              {profile.bio && (
                <div className="mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">About Me</h4>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{profile.bio}</p>
                </div>
              )}

              {/* Roles */}
              {roles.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Roles</h4>
                  <div className="flex flex-wrap gap-1">
                    {roles.map((role) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-bg-elevated"
                        style={{ color: role.color ?? "#F5F5F7" }}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: role.color ?? "#71717A" }}
                        />
                        {role.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Member since */}
              <div className="mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Member Since</h4>
                <p className="text-sm text-text-secondary">{formatRelativeTime(profile.createdAt)}</p>
              </div>

              {/* Edit profile button for own profile */}
              {isOwnProfile && onEditProfile && (
                <button
                  onClick={() => { onEditProfile(); onClose(); }}
                  className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
                >
                  Edit Profile
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-text-muted py-4 text-center">User not found</p>
          )}
        </div>
      </div>
    </div>
  );
}
