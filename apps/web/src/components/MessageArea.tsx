import MessageHeader from "./MessageHeader";
import MessageList from "./MessageList";
import TypingIndicator from "./TypingIndicator";
import MessageInput from "./MessageInput";
import { useChannelStore } from "../stores/channelStore";

export default function MessageArea({
  onToggleMembers,
  membersVisible,
}: {
  onToggleMembers: () => void;
  membersVisible: boolean;
}) {
  const selectedChannel = useChannelStore((s) => {
    const ch = s.channels.find((c) => c.id === s.selectedChannelId);
    return ch;
  });

  const channelName = selectedChannel?.name ?? "general";
  const topic = selectedChannel?.topic ?? undefined;

  return (
    <main className="flex flex-1 flex-col bg-bg-content min-w-0">
      <MessageHeader
        channelName={channelName}
        topic={topic}
        onToggleMembers={onToggleMembers}
        membersVisible={membersVisible}
      />
      <MessageList />
      <TypingIndicator />
      <MessageInput channelName={channelName} />
    </main>
  );
}
