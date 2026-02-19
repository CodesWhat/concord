import { useEffect, useRef } from "react";

const COMMON_EMOJIS = [
  "😀", "😂", "😍", "🥹", "😎", "🤔", "😢", "😡",
  "👍", "👎", "👀", "🙏", "🎉", "🔥", "❤️", "✅",
  "💯", "🚀", "😮", "🤣", "😅", "🫡", "💀", "🥳",
  "⭐", "💪", "🤝", "🌟",
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}

export default function EmojiPicker({ onSelect, onClose, anchorRect }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Position picker above or below the anchor depending on available space
  const viewportHeight = window.innerHeight;
  const pickerHeight = 180;
  const spaceBelow = viewportHeight - anchorRect.bottom;
  const positionAbove = spaceBelow < pickerHeight;

  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(anchorRect.left, window.innerWidth - 240),
    zIndex: 50,
    ...(positionAbove
      ? { bottom: viewportHeight - anchorRect.top + 4 }
      : { top: anchorRect.bottom + 4 }),
  };

  return (
    <div
      ref={pickerRef}
      style={style}
      className="w-56 rounded-lg border border-border bg-bg-elevated shadow-xl p-2"
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="grid grid-cols-7 gap-0.5">
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-bg-content focus-visible:ring-1 focus-visible:ring-primary/50 outline-none transition-colors"
            title={emoji}
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
