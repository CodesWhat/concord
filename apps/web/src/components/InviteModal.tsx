import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useServerStore } from "../stores/serverStore";

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { label: "30 minutes", value: 1800 },
  { label: "1 hour", value: 3600 },
  { label: "6 hours", value: 21600 },
  { label: "12 hours", value: 43200 },
  { label: "1 day", value: 86400 },
  { label: "7 days", value: 604800 },
  { label: "Never", value: 0 },
];

export default function InviteModal({ open, onClose }: InviteModalProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(86400); // Default 1 day
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const selectedServerId = useServerStore((s) => s.selectedServerId);

  const generateInvite = async () => {
    if (!selectedServerId) return;
    setLoading(true);
    try {
      const result = await api.post<{ code: string }>(
        `/api/v1/servers/${selectedServerId}/invites`,
        { expiresIn: expiresIn || undefined },
      );
      setInviteCode(result.code);
      setCopied(false);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !inviteCode) {
      generateInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCopy = async () => {
    if (!inviteCode) return;
    const url = `${window.location.origin}/invite/${inviteCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setInviteCode(null);
    setCopied(false);
    onClose();
  };

  if (!open) return null;

  const inviteUrl = inviteCode
    ? `${window.location.origin}/invite/${inviteCode}`
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-bg-sidebar p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-xl font-bold text-text-primary">
          Invite People
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          Share this link to invite people to your server.
        </p>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Invite Link
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={loading ? "Generating..." : inviteUrl}
              className="flex-1 rounded-lg bg-bg-deepest px-3 py-2 text-sm text-text-primary outline-none"
            />
            <button
              onClick={handleCopy}
              disabled={!inviteCode}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/80 disabled:opacity-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Expire After
          </label>
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(Number(e.target.value))}
            className="w-full rounded-lg bg-bg-deepest px-3 py-2 text-sm text-text-primary outline-none"
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => {
              setInviteCode(null);
              generateInvite();
            }}
            className="text-sm text-text-muted hover:text-text-secondary"
          >
            Generate New Link
          </button>
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-text-muted hover:text-text-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
