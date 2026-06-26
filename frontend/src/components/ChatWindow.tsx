"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import type { PresenceUser, ChatMessage, Room } from "@/context/SocketContext";
import { formatMessageTime, formatLastSeen } from "@/utils/chat";
import UserAvatar from "./UserAvatar";
import GroupInfoModal from "./GroupInfoModal";

export default function ChatWindow({
  room,
  peerUsername,
  peerUser,
  currentUser,
  users,
  roomMessages,
  onSendMessage,
  onMarkRead,
  activeTypers,
  onTypingStatusChange,
  onAddMember,
  onRemoveMember,
}: {
  room: Room;
  peerUsername: string;
  peerUser: PresenceUser | undefined;
  currentUser: string;
  users: PresenceUser[];
  roomMessages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onMarkRead: () => void;
  activeTypers: string[];
  onTypingStatusChange: (isTyping: boolean) => void;
  onAddMember: (roomId: string, username: string) => Promise<Room | null>;
  onRemoveMember: (roomId: string, username: string) => Promise<Room | null>;
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

  const getTypingDisplay = () => {
    if (activeTypers.length === 0) return null;
    if (activeTypers.length === 1) return `${activeTypers[0]} is typing...`;
    if (activeTypers.length === 2)
      return `${activeTypers[0]} and ${activeTypers[1]} are typing...`;
    return `${activeTypers.length} people are typing...`;
  };

  const typingDisplay = getTypingDisplay();

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
            const isLastMessage = i === roomMessages.length - 1;
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
                    className={`m-0 mt-1.5 text-[10px] flex items-center justify-end gap-1.5 ${isOwn ? "text-white/70" : "text-[#C2C2CE]"}`}
                  >
                    {formatMessageTime(msg.createdAt)}
                    {isOwn && isLastMessage && (
                      <span
                        className={`font-semibold ${isRead ? "text-white" : "text-white/50"}`}
                      >
                        {isRead ? "Seen" : "Sent"}
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
        {typingDisplay && (
          <div className="text-xs text-green-500 font-medium pl-1 animate-pulse">
            {typingDisplay}
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
          onAddMember={onAddMember}
          onRemoveMember={onRemoveMember}
        />
      )}
    </div>
  );
}
