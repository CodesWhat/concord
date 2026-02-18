import { useState, useEffect } from "react";
import { useServerStore } from "../stores/serverStore";

export default function CreateServerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createServer = useServerStore((s) => s.createServer);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createServer(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-bg-sidebar shadow-2xl p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary">Create a Server</h2>
        <p className="text-sm text-text-muted mb-6">
          Give your server a name and personality
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="server-name" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Server Name
            </label>
            <input
              id="server-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Server"
              className="w-full rounded-lg bg-bg-deepest px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 border border-border outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          <div>
            <label htmlFor="server-desc" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Description <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              id="server-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this server about?"
              className="w-full resize-none rounded-lg bg-bg-deepest px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 border border-border outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-primary/50 outline-none"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
