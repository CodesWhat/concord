import { useState, useEffect } from "react";
import ServerRail from "../../components/ServerRail";
import ChannelSidebar from "../../components/ChannelSidebar";
import MessageArea from "../../components/MessageArea";
import MemberSidebar from "../../components/MemberSidebar";
import MobileNav from "../../components/MobileNav";
import QuickSwitcher from "../../components/QuickSwitcher";
import SearchPanel from "../../components/SearchPanel";
import ActivityPanel from "../../components/ActivityPanel";
import { useServerStore } from "../../stores/serverStore";
import { useChannelStore } from "../../stores/channelStore";
import { useMessageStore } from "../../stores/messageStore";
import { gateway } from "../../api/gateway";
import "../../styles/chat.css";

export default function ChatPage() {
  const [membersVisible, setMembersVisible] = useState(true);
  const [showChannels, setShowChannels] = useState(false);

  const fetchServers = useServerStore((s) => s.fetchServers);
  const servers = useServerStore((s) => s.servers);
  const selectedServerId = useServerStore((s) => s.selectedServerId);
  const selectServer = useServerStore((s) => s.selectServer);
  const fetchMembers = useServerStore((s) => s.fetchMembers);
  const fetchChannels = useChannelStore((s) => s.fetchChannels);
  const channels = useChannelStore((s) => s.channels);
  const selectedChannelId = useChannelStore((s) => s.selectedChannelId);
  const selectChannel = useChannelStore((s) => s.selectChannel);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);

  // On mount: fetch servers and connect gateway
  useEffect(() => {
    fetchServers();
    gateway.connect();
    return () => gateway.disconnect();
  }, [fetchServers]);

  // When servers load, auto-select first server
  useEffect(() => {
    if (servers.length > 0 && !selectedServerId) {
      const first = servers[0]!;
      selectServer(first.id);
      fetchChannels(first.id);
      fetchMembers(first.id);
    }
  }, [servers, selectedServerId, selectServer, fetchChannels, fetchMembers]);

  // When channels load for selected server, auto-select first text channel
  useEffect(() => {
    if (channels.length > 0 && !selectedChannelId) {
      const textChannel = channels.find((c) => c.type === "text");
      if (textChannel) {
        selectChannel(textChannel.id);
        fetchMessages(textChannel.id);
      }
    }
  }, [channels, selectedChannelId, selectChannel, fetchMessages]);

  return (
    <div className="flex h-dvh flex-col">
      <QuickSwitcher />
      <SearchPanel />
      <ActivityPanel />
      <div className="flex flex-1 overflow-hidden">
        <ServerRail />

        <div
          className={`
            absolute inset-y-0 left-0 z-30 transition-transform duration-200 md:static md:translate-x-0
            ${showChannels ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <ChannelSidebar onBack={() => setShowChannels(false)} />
        </div>

        {showChannels && (
          <div
            className="absolute inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setShowChannels(false)}
          />
        )}

        <MessageArea
          onToggleMembers={() => setMembersVisible((v) => !v)}
          membersVisible={membersVisible}
        />

        {membersVisible && <MemberSidebar />}
      </div>

      <MobileNav />
    </div>
  );
}
