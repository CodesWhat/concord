import MessageHeader from "./MessageHeader";
import MessageList from "./MessageList";
import TypingIndicator from "./TypingIndicator";
import MessageInput from "./MessageInput";
import OfflineIndicator from "./OfflineIndicator";
import ThreadPanel from "./ThreadPanel";
import ForumView from "./ForumView";
import { useChannelStore } from "../stores/channelStore";
import { useThreadStore } from "../stores/threadStore";

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
  const activeThreadId = useThreadStore((s) => s.activeThreadId);

  const channelName = selectedChannel?.name ?? "general";
  const topic = selectedChannel?.topic ?? undefined;
  const isForum = selectedChannel?.type === "forum";

  return (
    <main className="flex flex-1 flex-col bg-bg-content min-w-0">
      <MessageHeader
        channelName={channelName}
        topic={topic}
        onToggleMembers={onToggleMembers}
        membersVisible={membersVisible}
      />
      <div className="flex flex-1 overflow-hidden">
        {isForum ? (
          <ForumView channelId={selectedChannel!.id} />
        ) : (
          <div className="flex flex-1 flex-col min-w-0">
            <OfflineIndicator />
            <MessageList />
            <TypingIndicator />
            <MessageInput channelName={channelName} />
          </div>
        )}
        {activeThreadId && <ThreadPanel />}
      </div>
    </main>
  );
}
