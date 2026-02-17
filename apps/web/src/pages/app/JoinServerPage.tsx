import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { api } from "../../api/client";
import { useAuthStore } from "../../stores/authStore";

interface InviteInfo {
  code: string;
  server: {
    id: string;
    name: string;
    iconUrl: string | null;
    memberCount?: number;
  };
  inviter: { displayName: string } | null;
  expiresAt: string | null;
}

export default function JoinServerPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) return;
    api
      .get<InviteInfo>(`/api/v1/invites/${code}`)
      .then(setInvite)
      .catch(() => setError("This invite is invalid or has expired."));
  }, [code]);

  const handleJoin = async () => {
    if (!code) return;
    setJoining(true);
    try {
      await api.post(`/api/v1/invites/${code}/accept`);
      navigate("/app");
    } catch {
      setError("Failed to join server.");
    } finally {
      setJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-deepest">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-bg-deepest">
        <div className="w-full max-w-sm rounded-xl bg-bg-sidebar p-8 text-center shadow-2xl">
          <h1 className="mb-2 text-xl font-bold text-text-primary">
            Invalid Invite
          </h1>
          <p className="mb-6 text-sm text-text-muted">{error}</p>
          <Link to="/app" className="text-sm text-primary hover:underline">
            Go to Concord
          </Link>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-deepest">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-deepest">
      <div className="w-full max-w-sm rounded-xl bg-bg-sidebar p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-white">
          {invite.server.name.charAt(0).toUpperCase()}
        </div>
        <p className="mb-1 text-sm text-text-muted">
          You've been invited to join
        </p>
        <h1 className="mb-1 text-2xl font-bold text-text-primary">
          {invite.server.name}
        </h1>
        {invite.inviter && (
          <p className="mb-6 text-xs text-text-muted">
            Invited by {invite.inviter.displayName}
          </p>
        )}

        {!isAuthenticated ? (
          <div>
            <p className="mb-4 text-sm text-text-muted">
              You need to log in first.
            </p>
            <Link
              to={`/login?redirect=/invite/${code}`}
              className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/80"
            >
              Log In to Join
            </Link>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/80 disabled:opacity-50"
          >
            {joining ? "Joining..." : "Accept Invite"}
          </button>
        )}
      </div>
    </div>
  );
}
