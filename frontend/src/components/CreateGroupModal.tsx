"use client";

import { useState } from "react";
import type { PresenceUser } from "@/context/SocketContext";
import UserAvatar from "./UserAvatar";

export default function CreateGroupModal({
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
