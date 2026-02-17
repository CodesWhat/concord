import { useTypingStore } from "../stores/typingStore";
import { useChannelStore } from "../stores/channelStore";
import { useServerStore } from "../stores/serverStore";
import { useAuthStore } from "../stores/authStore";

export default function TypingIndicator() {
  const selectedChannelId = useChannelStore((s) => s.selectedChannelId);
  const typingUsers = useTypingStore((s) =>
    selectedChannelId ? s.getTypingUsers(selectedChannelId) : []
  );
  const members = useServerStore((s) => s.members);
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Filter out self
  const otherTyping = typingUsers.filter((id) => id !== currentUserId);

  if (otherTyping.length === 0) return null;

  // Resolve display names
  const names = otherTyping.map((uid) => {
    const member = members.find((m) => m.userId === uid);
    return member?.user.displayName ?? "Someone";
  });

  let text: string;
  if (names.length === 1) {
    text = `${names[0]} is typing`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`;
  } else if (names.length === 3) {
    text = `${names[0]}, ${names[1]}, and ${names[2]} are typing`;
  } else {
    text = "Several people are typing";
  }

  return (
    <div className="flex items-center gap-2 px-4 pb-1 h-6">
      <TypingDots />
      <span className="text-xs text-text-muted truncate">
        <span className="font-medium text-text-secondary">{text}</span>
        ...
      </span>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1 w-1 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
      <span className="h-1 w-1 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
      <span className="h-1 w-1 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
    </span>
  );
}
