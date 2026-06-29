"use client";

import { useState } from "react";
import { useSocket } from "@/context/SocketContext";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import EmptyState from "./EmptyState";
import CreateGroupModal from "./CreateGroupModal";

// Main Dashboard

interface ChatDashboardProps {
  currentUser?: string;
  onLogout?: () => void;
}

export default function ChatDashboard({
  currentUser: currentUserProp,
  onLogout,
}: ChatDashboardProps) {
  const {
    rooms,
    users,
    messages,
    unreadCounts,
    typingUsers,
    sendMessage,
    fetchHistory,
    markRead,
    clearUnread,
    setActiveRoom,
    sendTypingStatus,
    createDMRoom,
    createGroupRoom,
    addMember,
    removeMember,
  } = useSocket();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const currentUser = currentUserProp;

  if (!currentUser) return null;

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setActiveRoom(roomId);
    clearUnread(roomId);
    fetchHistory(roomId);
  };

  const handleStartChat = async (recipientId: string) => {
    const existingRoom = rooms.find(
      (r) =>
        r.type === "direct" &&
        r.members.includes(recipientId) &&
        r.members.includes(currentUser),
    );

    if (existingRoom) {
      handleSelectRoom(existingRoom._id);
    } else {
      const newRoom = await createDMRoom(recipientId);
      if (newRoom) {
        handleSelectRoom(newRoom._id);
      }
    }
  };

  const handleCreateGroup = async (name: string, members: string[]) => {
    const newRoom = await createGroupRoom(name, members);
    if (newRoom) {
      handleSelectRoom(newRoom._id);
      setIsGroupModalOpen(false);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!activeRoomId) return;
    sendMessage(activeRoomId, content);
  };

  const handleMarkRead = () => {
    if (!activeRoomId) return;
    markRead(activeRoomId);
  };

  const handleTypingStatusChange = (isTyping: boolean) => {
    if (!activeRoomId) return;
    sendTypingStatus(activeRoomId, isTyping);
  };

  const activeRoom = rooms.find((r) => r._id === activeRoomId);
  const peerUsername =
    activeRoom?.type === "direct"
      ? activeRoom.members.find((m) => m !== currentUser) || ""
      : activeRoom?.name || "Group";

  const activePeerUser = users.find((u) => u.username === peerUsername);
  const activeMessages = activeRoomId ? (messages[activeRoomId] ?? []) : [];

  const activeTypers = activeRoomId
    ? (typingUsers[activeRoomId] ?? []).filter((u) => u !== currentUser)
    : [];

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar
        rooms={rooms}
        users={users}
        currentUser={currentUser}
        activeRoomId={activeRoomId}
        onSelectRoom={handleSelectRoom}
        onStartChat={handleStartChat}
        onOpenGroupModal={() => setIsGroupModalOpen(true)}
        messages={messages}
        typingUsers={typingUsers}
        unreadCounts={unreadCounts}
      />
      {activeRoom ? (
        <ChatWindow
          key={activeRoomId}
          room={activeRoom}
          peerUsername={peerUsername}
          peerUser={activePeerUser}
          currentUser={currentUser}
          users={users}
          roomMessages={activeMessages}
          onSendMessage={handleSendMessage}
          onMarkRead={handleMarkRead}
          activeTypers={activeTypers}
          onTypingStatusChange={handleTypingStatusChange}
          onAddMember={addMember}
          onRemoveMember={removeMember}
        />
      ) : (
        <EmptyState />
      )}
      {onLogout ? (
        <button
          onClick={onLogout}
          className="fixed top-4 right-4 z-10 border-none bg-white rounded-full p-2.5 px-3.5 shadow-md cursor-pointer text-[13px] font-semibold text-[#1A1A2E]"
        >
          Log out
        </button>
      ) : null}

      {isGroupModalOpen && (
        <CreateGroupModal
          users={users}
          currentUser={currentUser}
          onClose={() => setIsGroupModalOpen(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </div>
  );
}
