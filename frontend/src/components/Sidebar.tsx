"use client";

import { useState } from "react";
import type { PresenceUser, ChatMessage, Room } from "@/context/SocketContext";
import { formatMessageTime } from "@/utils/chat";
import UserAvatar from "./UserAvatar";
import UnreadBadge from "./UnreadBadge";

export default function Sidebar({
  rooms,
  users,
  currentUser,
  activeRoomId,
  onSelectRoom,
  onStartChat,
  onOpenGroupModal,
  messages,
  typingUsers,
  unreadCounts,
}: {
  rooms: Room[];
  users: PresenceUser[];
  currentUser: string;
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onStartChat: (recipientId: string) => void;
  onOpenGroupModal: () => void;
  messages: Record<string, ChatMessage[]>;
  typingUsers: Record<string, string[]>;
  unreadCounts: Record<string, number>;
}) {
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const getRoomDisplayInfo = (
    room: Room,
  ): { name: string; isOnline: boolean } => {
    if (room.type === "direct") {
      const peerUsername =
        room.members.find((m) => m !== currentUser) || "Unknown";
      const peer = users.find((u) => u.username === peerUsername);
      return { name: peerUsername, isOnline: peer?.isOnline ?? false };
    }
    return { name: room.name || "Group Chat", isOnline: false };
  };

  const filteredRooms = rooms
    .filter((room) => {
      const { name } = getRoomDisplayInfo(room);
      return search ? name.toLowerCase().includes(search.toLowerCase()) : true;
    })
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

  const searchResults = users
    .filter(
      (u) =>
        u.username !== currentUser &&
        u.username.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1));

  return (
    <aside className="w-75 shrink-0 bg-white flex flex-col border-r border-[#EFEFEF]">
      {/* Header */}
      <div className="p-5 pb-3.5 border-b border-[#F3F3F3]">
        <div className="flex items-center justify-between mb-3.5">
          <span className="text-lg font-bold text-[#1A1A2E] tracking-[-0.3px]">
            Messages
          </span>
          <div
            className="w-8 h-8 rounded-[10px] bg-[#E8E6FF] flex items-center justify-center cursor-pointer"
            onClick={onOpenGroupModal}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6C63FF"
              strokeWidth="2.2"
              width={15}
              height={15}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-[#F7F5F2] rounded-[10px] p-2 px-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9B9BAD"
            strokeWidth="2"
            width={14}
            height={14}
            className="shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search or start new chat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsSearching(true)}
            className="bg-transparent border-none outline-none text-[13.5px] text-[#1A1A2E] w-full"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isSearching && search ? (
          <>
            <div className="p-3 px-5 pb-1.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#C2C2CE]">
                Start new chat
              </span>
            </div>
            {searchResults.length === 0 ? (
              <div className="text-center text-[#9B9BAD] text-[13px] mt-6 px-6">
                No users found.
              </div>
            ) : (
              searchResults.map((user) => (
                <button
                  key={user.username}
                  onClick={() => {
                    onStartChat(user.username);
                    setSearch("");
                    setIsSearching(false);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 px-5 bg-transparent border-none border-l-[3px] border-transparent cursor-pointer text-left hover:bg-[#FAFAFA]"
                >
                  <UserAvatar name={user.username} isOnline={user.isOnline} />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-[#1A1A2E]">
                      {user.username}
                    </span>
                  </div>
                </button>
              ))
            )}
          </>
        ) : (
          <>
            <div className="p-3 px-5 pb-1.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#C2C2CE]">
                All conversations
              </span>
            </div>
            {filteredRooms.length === 0 ? (
              <div className="text-center text-[#9B9BAD] text-[13px] mt-12 px-6">
                {search
                  ? "No conversations match."
                  : "No conversations yet. Start a new chat!"}
              </div>
            ) : (
              filteredRooms.map((room) => {
                const { name, isOnline } = getRoomDisplayInfo(room);
                const isActive = activeRoomId === room._id;
                const lastMsg =
                  messages[room._id]?.[messages[room._id].length - 1];
                const isPeerTyping = typingUsers[room._id]?.length > 0;
                const unread = unreadCounts[room._id] ?? 0;

                return (
                  <button
                    key={room._id}
                    onClick={() => onSelectRoom(room._id)}
                    className={`w-full flex items-center gap-3 p-2.5 px-5 border-none border-l-[3px] cursor-pointer text-left transition-colors duration-100 ${
                      isActive
                        ? "bg-[#F7F5FF] border-l-[#6C63FF]"
                        : "bg-transparent border-transparent hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <UserAvatar name={name} isOnline={isOnline} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-1.5">
                        <span
                          className={`text-sm text-[#1A1A2E] whitespace-nowrap overflow-hidden text-ellipsis max-w-27.5 ${unread > 0 ? "font-bold" : "font-semibold"}`}
                        >
                          {name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {lastMsg && !isPeerTyping && unread === 0 && (
                            <span className="text-[11px] text-[#C2C2CE]">
                              {formatMessageTime(lastMsg.createdAt)}
                            </span>
                          )}
                          <UnreadBadge count={unread} />
                        </div>
                      </div>
                      <p
                        className={`text-[12.5px] m-0 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis ${
                          isPeerTyping
                            ? "text-green-500 font-medium"
                            : unread > 0
                              ? "text-[#1A1A2E] font-medium"
                              : "text-[#9B9BAD] font-normal"
                        }`}
                      >
                        {isPeerTyping
                          ? "typing..."
                          : lastMsg
                            ? lastMsg.content
                            : room.type === "direct"
                              ? isOnline
                                ? "Online now"
                                : "Offline"
                              : "Tap to chat"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Current user footer */}
      <div className="p-3.5 px-5 border-t border-[#F3F3F3] flex items-center gap-2.5">
        <UserAvatar name={currentUser} isOnline={true} size="sm" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-[#1A1A2E] whitespace-nowrap overflow-hidden text-ellipsis">
            {currentUser}
          </p>
          <p className="text-[11.5px] text-[#6C63FF] font-medium">
            You · Online
          </p>
        </div>
      </div>
    </aside>
  );
}
