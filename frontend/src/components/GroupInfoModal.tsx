"use client";

import { useState } from "react";
import type { PresenceUser, Room } from "@/context/SocketContext";
import UserAvatar from "./UserAvatar";
import { formatLastSeen } from "@/utils/chat";

export default function GroupInfoModal({
  room,
  users,
  currentUser,
  onClose,
  onAddMember,
  onRemoveMember,
}: {
  room: Room;
  users: PresenceUser[];
  currentUser: string;
  onClose: () => void;
  onAddMember: (roomId: string, username: string) => Promise<Room | null>;
  onRemoveMember: (roomId: string, username: string) => Promise<Room | null>;
}) {
  const [search, setSearch] = useState("");
  const isAdmin = room.admins.includes(currentUser);

  const nonMembers = users.filter(
    (u) => !room.members.includes(u.username) && u.username !== currentUser,
  );
  const filteredNonMembers = nonMembers.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAdd = async (username: string) => {
    await onAddMember(room._id, username);
    setSearch("");
  };

  const handleRemove = async (username: string) => {
    await onRemoveMember(room._id, username);
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
        <div className="flex flex-col items-center mb-5">
          <UserAvatar name={room.name || "Group"} isOnline={false} size="lg" />
          <h2 className="text-lg font-bold text-[#1A1A2E] mt-2">{room.name}</h2>
          <p className="text-sm text-[#9B9BAD]">
            {room.members.length} members
          </p>
        </div>

        {isAdmin && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-[#9B9BAD] mb-2">
              ADD MEMBERS
            </p>
            <input
              type="text"
              placeholder="Search users to add..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border-[1.5px] border-[#EFEFEF] bg-[#F7F5F2] text-sm outline-none focus:border-[#6C63FF] mb-2"
            />
            {search && (
              <div className="max-h-25 overflow-y-auto flex flex-col gap-1 border border-[#EFEFEF] rounded-lg p-1">
                {filteredNonMembers.length === 0 ? (
                  <p className="text-center text-xs text-[#9B9BAD] p-2">
                    No users found.
                  </p>
                ) : (
                  filteredNonMembers.map((user) => (
                    <button
                      key={user.username}
                      onClick={() => handleAdd(user.username)}
                      className="flex items-center gap-2 p-2 rounded-md text-left text-sm hover:bg-[#E8E6FF] text-[#1A1A2E]"
                    >
                      <UserAvatar
                        name={user.username}
                        isOnline={user.isOnline}
                        size="sm"
                      />
                      <span className="flex-1">{user.username}</span>
                      <span className="text-[#6C63FF] font-bold text-xs">
                        Add +
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-xs font-semibold text-[#9B9BAD] mb-2">MEMBERS</p>
        <div className="max-h-62.5 overflow-y-auto flex flex-col gap-1 mb-4 border border-[#EFEFEF] rounded-lg p-2">
          {room.members.map((username) => {
            const user = users.find((u) => u.username === username);
            const isMemberAdmin = room.admins.includes(username);
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
                <div className="flex items-center gap-2">
                  {isMemberAdmin && (
                    <span className="text-xs font-bold text-[#6C63FF] bg-[#E8E6FF] px-2 py-1 rounded-md">
                      Admin
                    </span>
                  )}
                  {isAdmin && !isMemberAdmin && !isMe && (
                    <button
                      onClick={() => handleRemove(username)}
                      className="text-xs font-bold text-red-500 bg-red-100 px-2 py-1 rounded-md hover:bg-red-200 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
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
