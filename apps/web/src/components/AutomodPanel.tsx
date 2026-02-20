import { useState, useEffect } from "react";
import { useAutomodStore } from "../stores/automodStore";

interface AutomodPanelProps {
  serverId: string;
}

type RuleType = "word_filter" | "link_filter" | "spam" | "raid";

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  word_filter: "Word Filter",
  link_filter: "Link Filter",
  spam: "Spam Protection",
  raid: "Raid Protection",
};

const ACTION_OPTIONS = ["delete", "warn", "mute", "kick"] as const;

export default function AutomodPanel({ serverId }: AutomodPanelProps) {
  const { rules, isLoading, fetchRules, createRule, updateRule, deleteRule, toggleRule } =
    useAutomodStore();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<RuleType>("word_filter");
  const [newAction, setNewAction] = useState("delete");
  const [newConfig, setNewConfig] = useState<Record<string, unknown>>({});
  const [creating, setCreating] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editAction, setEditAction] = useState("delete");
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRules(serverId);
  }, [serverId, fetchRules]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createRule(serverId, {
        name: newName.trim(),
        type: newType,
        action: newAction,
        config: newConfig,
      });
      setShowCreate(false);
      setNewName("");
      setNewType("word_filter");
      setNewAction("delete");
      setNewConfig({});
    } catch {
      // error already logged in store
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (rule: (typeof rules)[0]) => {
    setEditingId(rule.id);
    setEditName(rule.name);
    setEditAction(rule.action);
    setEditConfig(rule.config);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      await updateRule(serverId, editingId, {
        name: editName.trim(),
        action: editAction,
        config: editConfig,
      });
      setEditingId(null);
    } catch {
      // error already logged in store
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteRule(serverId, ruleId);
      setConfirmDeleteId(null);
    } catch {
      // error already logged in store
    }
  };

  if (isLoading && rules.length === 0) {
    return <p className="text-sm text-text-muted py-4">Loading rules...</p>;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Rule list */}
      {rules.length === 0 && !showCreate && (
        <p className="text-sm text-text-muted py-4">No automod rules configured.</p>
      )}

      <div className="flex flex-col gap-2">
        {rules.map((rule) =>
          editingId === rule.id ? (
            <div key={rule.id} className="rounded-lg bg-bg-content p-3">
              <div className="flex flex-col gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md bg-bg-deepest px-3 py-1.5 text-sm text-text-primary outline-none"
                  placeholder="Rule name"
                />
                <div className="flex gap-2">
                  <span className="rounded-md bg-bg-deepest px-2 py-1.5 text-xs text-text-muted">
                    {RULE_TYPE_LABELS[rule.type]}
                  </span>
                  <select
                    value={editAction}
                    onChange={(e) => setEditAction(e.target.value)}
                    className="rounded-md bg-bg-deepest px-2 py-1.5 text-sm text-text-primary outline-none"
                  >
                    {ACTION_OPTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <ConfigEditor type={rule.type} config={editConfig} onChange={setEditConfig} />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/80 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs text-text-muted hover:text-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              key={rule.id}
              className="group flex items-center justify-between rounded-lg bg-bg-content px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => toggleRule(serverId, rule.id, !rule.enabled)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    rule.enabled ? "bg-primary" : "bg-bg-deepest"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      rule.enabled ? "translate-x-4" : ""
                    }`}
                  />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{rule.name}</p>
                  <p className="text-xs text-text-muted">
                    {RULE_TYPE_LABELS[rule.type]} &middot; {rule.action}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => startEdit(rule)}
                  className="rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-elevated hover:text-text-primary"
                >
                  Edit
                </button>
                {confirmDeleteId === rule.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="rounded px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-600/20"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-text-muted hover:text-text-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(rule.id)}
                    className="rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-elevated hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Create form */}
      {showCreate ? (
        <div className="mt-4 rounded-lg border border-border p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            New Rule
          </h4>
          <div className="flex flex-col gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md bg-bg-deepest px-3 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
              placeholder="Rule name"
            />
            <div className="flex gap-2">
              <select
                value={newType}
                onChange={(e) => {
                  setNewType(e.target.value as RuleType);
                  setNewConfig({});
                }}
                className="rounded-md bg-bg-deepest px-2 py-1.5 text-sm text-text-primary outline-none"
              >
                {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map((t) => (
                  <option key={t} value={t}>
                    {RULE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <select
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                className="rounded-md bg-bg-deepest px-2 py-1.5 text-sm text-text-primary outline-none"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <ConfigEditor type={newType} config={newConfig} onChange={setNewConfig} />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/80 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Rule"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="text-xs text-text-muted hover:text-text-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="mt-4 self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/80"
        >
          Add Rule
        </button>
      )}
    </div>
  );
}

// Dynamic config editor per rule type
function ConfigEditor({
  type,
  config,
  onChange,
}: {
  type: RuleType;
  config: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  switch (type) {
    case "word_filter":
      return (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Blocked words (comma-separated)</label>
          <textarea
            value={((config.words as string[]) ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...config,
                words: e.target.value
                  .split(",")
                  .map((w) => w.trim())
                  .filter(Boolean),
              })
            }
            rows={2}
            className="w-full resize-none rounded-md bg-bg-deepest px-3 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
            placeholder="badword1, badword2, ..."
          />
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={(config.matchMode as string) === "exact"}
              onChange={(e) =>
                onChange({ ...config, matchMode: e.target.checked ? "exact" : "contains" })
              }
              className="accent-primary"
            />
            Exact word match only
          </label>
        </div>
      );

    case "link_filter":
      return (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Blocked domains (comma-separated)</label>
          <textarea
            value={((config.blockedDomains as string[]) ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...config,
                blockedDomains: e.target.value
                  .split(",")
                  .map((d) => d.trim())
                  .filter(Boolean),
              })
            }
            rows={2}
            className="w-full resize-none rounded-md bg-bg-deepest px-3 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
            placeholder="spam.com, phish.net, ..."
          />
          <label className="text-xs text-text-muted">Allowed domains (comma-separated, leave empty to allow all)</label>
          <textarea
            value={((config.allowedDomains as string[]) ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...config,
                allowedDomains: e.target.value
                  .split(",")
                  .map((d) => d.trim())
                  .filter(Boolean),
              })
            }
            rows={2}
            className="w-full resize-none rounded-md bg-bg-deepest px-3 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
            placeholder="github.com, youtube.com, ..."
          />
        </div>
      );

    case "spam":
      return (
        <div className="flex gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Max messages</label>
            <input
              type="number"
              min={1}
              max={100}
              value={(config.maxMessages as number) ?? 5}
              onChange={(e) =>
                onChange({ ...config, maxMessages: parseInt(e.target.value, 10) || 5 })
              }
              className="w-20 rounded-md bg-bg-deepest px-2 py-1.5 text-sm text-text-primary outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Time window (seconds)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={(config.timeWindowSeconds as number) ?? 5}
              onChange={(e) =>
                onChange({ ...config, timeWindowSeconds: parseInt(e.target.value, 10) || 5 })
              }
              className="w-20 rounded-md bg-bg-deepest px-2 py-1.5 text-sm text-text-primary outline-none"
            />
          </div>
        </div>
      );

    case "raid":
      return (
        <div className="flex gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Join threshold</label>
            <input
              type="number"
              min={1}
              max={100}
              value={(config.joinThreshold as number) ?? 10}
              onChange={(e) =>
                onChange({ ...config, joinThreshold: parseInt(e.target.value, 10) || 10 })
              }
              className="w-20 rounded-md bg-bg-deepest px-2 py-1.5 text-sm text-text-primary outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Time window (seconds)</label>
            <input
              type="number"
              min={1}
              max={300}
              value={(config.timeWindowSeconds as number) ?? 60}
              onChange={(e) =>
                onChange({ ...config, timeWindowSeconds: parseInt(e.target.value, 10) || 60 })
              }
              className="w-20 rounded-md bg-bg-deepest px-2 py-1.5 text-sm text-text-primary outline-none"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}
