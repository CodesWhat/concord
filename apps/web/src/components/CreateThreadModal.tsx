import { useState, useEffect } from "react";

export default function CreateThreadModal({
  open,
  onClose,
  defaultName,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  defaultName: string;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

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
    onCreate(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-bg-sidebar shadow-2xl p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary mb-4">Create Thread</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="thread-name" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Thread Name
            </label>
            <input
              id="thread-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-bg-deepest px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 border border-border outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
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
