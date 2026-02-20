import { useEffect, useCallback, useRef } from "react";
import { useAuditStore } from "../stores/auditStore";

const ACTION_LABELS: Record<string, string> = {
  CHANNEL_CREATE: "created channel",
  CHANNEL_UPDATE: "updated channel",
  CHANNEL_DELETE: "deleted channel",
  ROLE_CREATE: "created role",
  ROLE_UPDATE: "updated role",
  ROLE_DELETE: "deleted role",
  MEMBER_BAN: "banned member",
  MEMBER_UNBAN: "unbanned member",
  MEMBER_KICK: "kicked member",
  MESSAGE_DELETE: "deleted message",
  SERVER_UPDATE: "updated server",
  AUTOMOD_RULE_CREATE: "created automod rule",
  AUTOMOD_RULE_UPDATE: "updated automod rule",
  AUTOMOD_RULE_DELETE: "deleted automod rule",
};

const ACTION_OPTIONS = Object.keys(ACTION_LABELS);

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChanges(changes: Record<string, unknown>): string {
  const parts = Object.entries(changes)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.join(", ");
}

interface Props {
  serverId: string;
}

export default function AuditLogPanel({ serverId }: Props) {
  const entries = useAuditStore((s) => s.entries);
  const isLoading = useAuditStore((s) => s.isLoading);
  const hasMore = useAuditStore((s) => s.hasMore);
  const filter = useAuditStore((s) => s.filter);
  const fetchAuditLog = useAuditStore((s) => s.fetchAuditLog);
  const loadMore = useAuditStore((s) => s.loadMore);
  const setFilter = useAuditStore((s) => s.setFilter);
  const reset = useAuditStore((s) => s.reset);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    reset();
    fetchAuditLog(serverId);
  }, [serverId, fetchAuditLog, reset]);

  useEffect(() => {
    fetchAuditLog(serverId);
  }, [filter, serverId, fetchAuditLog]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      loadMore(serverId);
    }
  }, [serverId, loadMore]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="mb-3 flex gap-2">
        <select
          value={filter.action ?? ""}
          onChange={(e) => setFilter({ ...filter, action: e.target.value || undefined })}
          className="appearance-none cursor-pointer rounded-lg bg-bg-deepest px-2 py-1.5 pr-8 text-xs text-text-primary outline-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23A1A1AA' stroke-width='2' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 6px center",
            backgroundSize: "14px",
          }}
        >
          <option value="">All Actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </select>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {entries.length === 0 && !isLoading && (
          <p className="py-8 text-center text-sm text-text-muted">
            No audit log entries.
          </p>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-bg-content"
          >
            <span className="mt-0.5 shrink-0 text-xs text-text-muted whitespace-nowrap">
              {formatTime(entry.createdAt)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-secondary">
                <span className="font-medium text-text-primary">
                  {entry.actorId.slice(0, 8)}
                </span>
                {" "}
                {ACTION_LABELS[entry.action] ?? entry.action}
                {entry.targetId && (
                  <span className="ml-1 text-text-muted">
                    ({entry.targetType}: {entry.targetId.slice(0, 8)})
                  </span>
                )}
              </p>
              {entry.reason && (
                <p className="text-xs text-text-muted mt-0.5">
                  Reason: {entry.reason}
                </p>
              )}
              {Object.keys(entry.changes).length > 0 && (
                <p className="text-xs text-text-muted mt-0.5 truncate">
                  {formatChanges(entry.changes)}
                </p>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <p className="py-4 text-center text-xs text-text-muted">Loading...</p>
        )}

        {!hasMore && entries.length > 0 && (
          <p className="py-4 text-center text-xs text-text-muted">
            End of audit log.
          </p>
        )}
      </div>
    </div>
  );
}
