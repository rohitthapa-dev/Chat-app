"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import {
  useSocket,
  type PresenceUser,
  type ChatMessage,
  type Room,
} from "@/context/SocketContext";

// Helpers

function formatLastSeen(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// Avatar

function UserAvatar({
  name,
  isOnline,
  size = "md",
}: {
  name: string;
  isOnline: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: {
      box: "w-8.5 h-8.5",
      font: "text-[11px]",
      dot: "w-2 h-2",
      border: "border-2",
    },
    md: {
      box: "w-10.5 h-10.5",
      font: "text-[13px]",
      dot: "w-2.5 h-2.5",
      border: "border-2",
    },
    lg: {
      box: "w-13 h-13",
      font: "text-[15px]",
      dot: "w-3 h-3",
      border: "border-2",
    },
  };
  const s = sizes[size];

  const hue =
    name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  return (
    <div className="relative shrink-0">
      <div
        className={`${s.box} rounded-full flex items-center justify-center font-bold ${s.font} text-white tracking-[0.03em] select-none`}
        style={{
          background: `linear-gradient(135deg, hsl(${hue},60%,62%) 0%, hsl(${hue},50%,50%) 100%)`,
        }}
      >
        {getInitials(name)}
      </div>
      <span
        className={`absolute bottom-0 right-0 ${s.dot} rounded-full ${isOnline ? "bg-green-500" : "bg-slate-300"} ${s.border} border-white`}
      />
    </div>
  );
}

// Unread badge

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-[10px] bg-[#6C63FF] text-white text-[11px] font-bold leading-none shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Sidebar

function Sidebar({
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

// Group Info Modal

function GroupInfoModal({
  room,
  users,
  currentUser,
  onClose,
}: {
  room: Room;
  users: PresenceUser[];
  currentUser: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-20 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center mb-5">
          <UserAvatar name={room.name || "Group"} isOnline={false} size="lg" />
          <h2 className="text-lg font-bold text-[#1A1A2E] mt-2">{room.name}</h2>
          <p className="text-sm text-[#9B9BAD]">
            {room.members.length} members
          </p>
        </div>

        <p className="text-xs font-semibold text-[#9B9BAD] mb-2">MEMBERS</p>
        <div className="max-h-62.5 overflow-y-auto flex flex-col gap-1 mb-4 border border-[#EFEFEF] rounded-lg p-2">
          {room.members.map((username) => {
            const user = users.find((u) => u.username === username);
            const isAdmin = room.admins.includes(username);
            const isMe = username === currentUser;

            return (
              <div
                key={username}
                className="flex items-center justify-between p-2 rounded-md hover:bg-[#F7F5F2]"
              >
                <div className="flex items-center gap-2">
                  <UserAvatar
                    name={username}
                    isOnline={user?.isOnline ?? false}
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[#1A1A2E]">
                      {username}{" "}
                      {isMe && (
                        <span className="text-[#6C63FF] text-xs">(You)</span>
                      )}
                    </span>
                    <span
                      className={`text-xs ${user?.isOnline ? "text-green-500" : "text-[#9B9BAD]"}`}
                    >
                      {user?.isOnline
                        ? "Online"
                        : user?.lastSeen
                          ? `Last seen ${formatLastSeen(new Date(user.lastSeen))}`
                          : "Offline"}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <span className="text-xs font-bold text-[#6C63FF] bg-[#E8E6FF] px-2 py-1 rounded-md">
                    Admin
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg bg-[#F7F5F2] text-[#9B9BAD] font-semibold text-sm hover:bg-[#EFEFEF] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Chat Window

function ChatWindow({
  room,
  peerUsername,
  peerUser,
  currentUser,
  users,
  roomMessages,
  onSendMessage,
  onMarkRead,
  isTypingActive,
  onTypingStatusChange,
}: {
  room: Room;
  peerUsername: string;
  peerUser: PresenceUser | undefined;
  currentUser: string;
  users: PresenceUser[];
  roomMessages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onMarkRead: () => void;
  isTypingActive: boolean;
  onTypingStatusChange: (isTyping: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    onMarkRead();
  }, [roomMessages, onMarkRead]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onTypingStatusChange(false);
    isTypingRef.current = false;

    onSendMessage(trimmed);
    setDraft("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStatusChange(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingStatusChange(false);
      isTypingRef.current = false;
    }, 2500);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F7F5F2]">
      {/* Chat header */}
      <div
        className={`bg-white p-3.5 px-6 flex items-center gap-3 border-b border-[#EFEFEF] shadow-sm ${room.type === "group" ? "cursor-pointer hover:bg-[#FAFAFA]" : ""}`}
        onClick={() => room.type === "group" && setIsGroupInfoOpen(true)}
      >
        <UserAvatar
          name={peerUsername}
          isOnline={peerUser?.isOnline ?? false}
        />
        <div>
          <p className="text-[15px] font-bold text-[#1A1A2E] tracking-[-0.2px]">
            {peerUsername}
          </p>
          <p className="text-xs text-[#9B9BAD] mt-0.5">
            {room.type === "group"
              ? `${room.members.length} members`
              : peerUser?.isOnline
                ? "Online"
                : peerUser?.lastSeen
                  ? `Last seen ${formatLastSeen(new Date(peerUser.lastSeen))}`
                  : "Offline"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 pb-2 flex flex-col gap-0.5">
        {roomMessages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-5 px-7 text-center shadow-md border border-[#E8E6FF]">
              <p className="text-[13.5px] text-[#9B9BAD]">
                No messages yet — say hi to{" "}
                <span className="text-[#6C63FF] font-semibold">
                  {peerUsername}
                </span>
                !
              </p>
            </div>
          </div>
        ) : (
          roomMessages.map((msg, i) => {
            const isOwn = msg.senderId === currentUser;
            const prevMsg = roomMessages[i - 1];
            const isContinuation = prevMsg && prevMsg.senderId === msg.senderId;
            const isRead = msg.readBy.includes(peerUsername);

            return (
              <div
                key={msg._id}
                className={`flex justify-${isOwn ? "end" : "start"} ${isContinuation ? "mt-0.5" : "mt-3.5"}`}
              >
                <div
                  className={`max-w-[62%] px-3.5 py-2.5 rounded-2xl ${
                    isOwn
                      ? "rounded-tr-sm bg-linear-to-br from-[#6C63FF] to-[#8B83FF] text-white shadow-md"
                      : "rounded-tl-sm bg-white text-[#1A1A2E] shadow-sm border border-[#F0F0F0]"
                  }`}
                >
                  <p className="m-0 whitespace-pre-wrap wrap-break-word text-sm leading-normal">
                    {msg.content}
                  </p>
                  <p
                    className={`m-0 mt-1.5 text-[10.5px] flex items-center justify-end gap-1 ${isOwn ? "text-white/65" : "text-[#C2C2CE]"}`}
                  >
                    {formatMessageTime(msg.createdAt)}
                    {isOwn && (
                      <span
                        className={`text-[11px] ${isRead ? "text-white/90" : "text-white/55"}`}
                      >
                        {isRead ? "✓✓" : "✓"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white p-3 px-5 flex flex-col gap-1.5 border-t border-[#EFEFEF] relative">
        {isTypingActive && (
          <div className="text-xs text-green-500 font-medium pl-1 animate-pulse">
            {peerUsername} is typing...
          </div>
        )}
        <div className="flex items-end gap-3 w-full">
          <textarea
            value={draft}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 bg-[#F7F5F2] border-[1.5px] border-[#EFEFEF] rounded-xl p-2.5 px-3.5 text-sm text-[#1A1A2E] outline-none resize-none max-h-30 leading-normal font-inherit transition-colors focus:border-[#6C63FF]"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className={`w-10.5 h-10.5 shrink-0 rounded-xl border-none flex items-center justify-center transition-opacity ${
              draft.trim()
                ? "bg-linear-to-br from-[#6C63FF] to-[#8B83FF] cursor-pointer shadow-md hover:opacity-85"
                : "bg-[#E8E6FF] cursor-not-allowed"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={draft.trim() ? "white" : "#9B9BAD"}
              width={18}
              height={18}
              style={{ transform: "translateX(1px)" }}
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Group Info Modal */}
      {isGroupInfoOpen && room.type === "group" && (
        <GroupInfoModal
          room={room}
          users={users}
          currentUser={currentUser}
          onClose={() => setIsGroupInfoOpen(false)}
        />
      )}
    </div>
  );
}

// Empty State

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#F7F5F2]">
      <div className="w-18 h-18 rounded-[22px] bg-linear-to-br from-[#6C63FF] to-[#9B8FFF] flex items-center justify-center mb-5 shadow-xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          width={36}
          height={36}
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[#1A1A2E] mb-2 tracking-[-0.3px]">
        Your messages
      </h2>
      <p className="text-[13.5px] text-[#9B9BAD] text-center max-w-60 leading-normal">
        Select a conversation or start a new chat to begin messaging.
      </p>
    </div>
  );
}

// Create Group Modal

function CreateGroupModal({
  users,
  currentUser,
  onClose,
  onCreate,
}: {
  users: PresenceUser[];
  currentUser: string;
  onClose: () => void;
  onCreate: (name: string, members: string[]) => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const toggleMember = (username: string) => {
    setSelectedMembers((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username],
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-20 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[#1A1A2E] mb-4">
          Create Group Chat
        </h2>

        <input
          type="text"
          placeholder="Group name (e.g. Dev Team)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="w-full py-2.5 px-3.5 rounded-lg border-[1.5px] border-[#EFEFEF] bg-[#F7F5F2] text-sm outline-none focus:border-[#6C63FF] mb-4"
        />

        <p className="text-xs font-semibold text-[#9B9BAD] mb-2">
          SELECT MEMBERS
        </p>
        <div className="max-h-50 overflow-y-auto flex flex-col gap-1 mb-4 border border-[#EFEFEF] rounded-lg p-2">
          {users
            .filter((u) => u.username !== currentUser)
            .map((user) => (
              <button
                key={user.username}
                onClick={() => toggleMember(user.username)}
                className={`flex items-center gap-2 p-2 rounded-md text-left text-sm ${
                  selectedMembers.includes(user.username)
                    ? "bg-[#E8E6FF] text-[#6C63FF] font-semibold"
                    : "hover:bg-[#F7F5F2] text-[#1A1A2E]"
                }`}
              >
                <UserAvatar
                  name={user.username}
                  isOnline={user.isOnline}
                  size="sm"
                />
                {user.username}
              </button>
            ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-[#F7F5F2] text-[#9B9BAD] font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(groupName, selectedMembers)}
            disabled={!groupName.trim() || selectedMembers.length < 2}
            className={`flex-1 py-2.5 rounded-lg text-white font-semibold text-sm ${
              groupName.trim() && selectedMembers.length >= 2
                ? "bg-linear-to-br from-[#6C63FF] to-[#8B83FF]"
                : "bg-[#C2C2CE] cursor-not-allowed"
            }`}
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const isPeerTypingInActiveRoom = !!(
    activeRoomId && typingUsers[activeRoomId]?.length > 0
  );

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
          isTypingActive={isPeerTypingInActiveRoom}
          onTypingStatusChange={handleTypingStatusChange}
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
