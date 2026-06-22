"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import {
  useSocket,
  getDMChannelId,
  type PresenceUser,
  type DMMessage,
} from "@/context/SocketContext";

//Helpers

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
  username,
  isOnline,
  size = "md",
}: {
  username: string;
  isOnline: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { box: 34, font: 11, dot: 9, border: 2 },
    md: { box: 42, font: 13, dot: 11, border: 2 },
    lg: { box: 52, font: 15, dot: 13, border: 2 },
  };
  const s = sizes[size];

  // Deterministic pastel hue from username
  const hue =
    username.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: s.box,
          height: s.box,
          borderRadius: "50%",
          background: `linear-gradient(135deg, hsl(${hue},60%,62%) 0%, hsl(${hue},50%,50%) 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: s.font,
          color: "#fff",
          letterSpacing: "0.03em",
          userSelect: "none",
        }}
      >
        {getInitials(username)}
      </div>
      <span
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: s.dot,
          height: s.dot,
          borderRadius: "50%",
          background: isOnline ? "#22c55e" : "#CBD5E1",
          border: `${s.border}px solid #fff`,
        }}
      />
    </div>
  );
}

//  Sidebar

function Sidebar({
  users,
  currentUser,
  activeChat,
  onSelectChat,
  messages,
}: {
  users: PresenceUser[];
  currentUser: string;
  activeChat: string | null;
  onSelectChat: (username: string) => void;
  messages: Record<string, DMMessage[]>;
}) {
  const [search, setSearch] = useState("");

  const peers = users
    .filter((u) => u.username !== currentUser)
    .filter((u) =>
      search ? u.username.toLowerCase().includes(search.toLowerCase()) : true,
    )
    .sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.username.localeCompare(b.username);
    });

  const getLastMessage = (peer: string): DMMessage | undefined => {
    const channelId = getDMChannelId(currentUser, peer);
    const msgs = messages[channelId];
    return msgs?.[msgs.length - 1];
  };

  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        background: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #EFEFEF",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 20px 14px",
          borderBottom: "1px solid #F3F3F3",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#1A1A2E",
              letterSpacing: "-0.3px",
            }}
          >
            Messages
          </span>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "#E8E6FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#F7F5F2",
            borderRadius: 10,
            padding: "8px 12px",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9B9BAD"
            strokeWidth="2"
            width={14}
            height={14}
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 13.5,
              color: "#1A1A2E",
              width: "100%",
            }}
          />
        </div>
      </div>

      {/* Section label */}
      <div
        style={{
          padding: "12px 20px 6px",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#C2C2CE",
          }}
        >
          All conversations
        </span>
      </div>

      {/* User list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {peers.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#9B9BAD",
              fontSize: 13,
              marginTop: 48,
              padding: "0 24px",
            }}
          >
            {search ? "No users match your search." : "No other users yet."}
          </div>
        ) : (
          peers.map((user) => {
            const lastMsg = getLastMessage(user.username);
            const isActive = activeChat === user.username;

            return (
              <button
                key={user.username}
                onClick={() => onSelectChat(user.username)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 20px",
                  background: isActive ? "#F7F5FF" : "transparent",
                  border: "none",
                  borderLeft: isActive
                    ? "3px solid #6C63FF"
                    : "3px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "#FAFAFA";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                <UserAvatar username={user.username} isOnline={user.isOnline} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1A1A2E",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 140,
                      }}
                    >
                      {user.username}
                    </span>
                    {lastMsg && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#C2C2CE",
                          flexShrink: 0,
                        }}
                      >
                        {formatMessageTime(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "#9B9BAD",
                      margin: "2px 0 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {lastMsg
                      ? lastMsg.content
                      : user.isOnline
                        ? "Online now"
                        : `Last seen ${formatLastSeen(new Date(user.lastSeen))}`}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Current user footer */}
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid #F3F3F3",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <UserAvatar username={currentUser} isOnline={true} size="sm" />
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "#1A1A2E",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {currentUser}
          </p>
          <p style={{ fontSize: 11.5, color: "#6C63FF", fontWeight: 500 }}>
            You · Online
          </p>
        </div>
      </div>
    </aside>
  );
}

// Chat Window

function ChatWindow({
  peerUsername,
  peerUser,
  currentUser,
  channelMessages,
  onSendDM,
  onMarkRead,
}: {
  peerUsername: string;
  peerUser: PresenceUser | undefined;
  currentUser: string;
  channelMessages: DMMessage[];
  onSendDM: (content: string) => void;
  onMarkRead: () => void;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    onMarkRead();
  }, [channelMessages, onMarkRead]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSendDM(trimmed);
    setDraft("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        background: "#F7F5F2",
      }}
    >
      {/* Chat header */}
      <div
        style={{
          background: "#FFFFFF",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid #EFEFEF",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <UserAvatar
          username={peerUsername}
          isOnline={peerUser?.isOnline ?? false}
        />
        <div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1A1A2E",
              letterSpacing: "-0.2px",
            }}
          >
            {peerUsername}
          </p>
          <p style={{ fontSize: 12, color: "#9B9BAD", marginTop: 1 }}>
            {peerUser?.isOnline
              ? "Online"
              : peerUser?.lastSeen
                ? `Last seen ${formatLastSeen(new Date(peerUser.lastSeen))}`
                : "Offline"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 24px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {channelMessages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 16,
                padding: "20px 28px",
                textAlign: "center",
                boxShadow: "0 2px 12px rgba(108,99,255,0.08)",
                border: "1px solid #E8E6FF",
              }}
            >
              <p style={{ fontSize: 13.5, color: "#9B9BAD" }}>
                No messages yet — say hi to{" "}
                <span style={{ color: "#6C63FF", fontWeight: 600 }}>
                  {peerUsername}
                </span>
                !
              </p>
            </div>
          </div>
        ) : (
          channelMessages.map((msg, i) => {
            const isOwn = msg.senderId === currentUser;
            const prevMsg = channelMessages[i - 1];
            const isContinuation = prevMsg && prevMsg.senderId === msg.senderId;

            return (
              <div
                key={msg._id}
                style={{
                  display: "flex",
                  justifyContent: isOwn ? "flex-end" : "flex-start",
                  marginTop: isContinuation ? 2 : 14,
                }}
              >
                <div
                  style={{
                    maxWidth: "62%",
                    padding: "10px 14px",
                    borderRadius: isOwn
                      ? "18px 4px 18px 18px"
                      : "4px 18px 18px 18px",
                    background: isOwn
                      ? "linear-gradient(135deg, #6C63FF 0%, #8B83FF 100%)"
                      : "#FFFFFF",
                    color: isOwn ? "#FFFFFF" : "#1A1A2E",
                    fontSize: 14,
                    lineHeight: 1.55,
                    boxShadow: isOwn
                      ? "0 2px 10px rgba(108,99,255,0.22)"
                      : "0 1px 4px rgba(0,0,0,0.07)",
                    border: isOwn ? "none" : "1px solid #F0F0F0",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.content}
                  </p>
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 10.5,
                      color: isOwn ? "rgba(255,255,255,0.65)" : "#C2C2CE",
                      textAlign: "right",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 3,
                    }}
                  >
                    {formatMessageTime(msg.createdAt)}
                    {isOwn && (
                      <span
                        style={{
                          color: msg.read
                            ? "rgba(255,255,255,0.9)"
                            : "rgba(255,255,255,0.55)",
                          fontSize: 11,
                        }}
                      >
                        {msg.read ? "✓✓" : "✓"}
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

      {/* Input bar */}
      <div
        style={{
          background: "#FFFFFF",
          padding: "12px 20px",
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          borderTop: "1px solid #EFEFEF",
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          style={{
            flex: 1,
            background: "#F7F5F2",
            border: "1.5px solid #EFEFEF",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 14,
            color: "#1A1A2E",
            outline: "none",
            resize: "none",
            maxHeight: 120,
            lineHeight: 1.5,
            fontFamily: "inherit",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#6C63FF")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#EFEFEF")}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim()}
          style={{
            width: 42,
            height: 42,
            flexShrink: 0,
            borderRadius: 12,
            border: "none",
            background: draft.trim()
              ? "linear-gradient(135deg, #6C63FF 0%, #8B83FF 100%)"
              : "#E8E6FF",
            cursor: draft.trim() ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 0.15s",
            boxShadow: draft.trim()
              ? "0 4px 12px rgba(108,99,255,0.28)"
              : "none",
          }}
          onMouseEnter={(e) => {
            if (draft.trim()) e.currentTarget.style.opacity = "0.85";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
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
  );
}

//  Empty State

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#F7F5F2",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: "linear-gradient(135deg, #6C63FF 0%, #9B8FFF 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          boxShadow: "0 8px 24px rgba(108,99,255,0.28)",
        }}
      >
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
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#1A1A2E",
          marginBottom: 8,
          letterSpacing: "-0.3px",
        }}
      >
        Your messages
      </h2>
      <p
        style={{
          fontSize: 13.5,
          color: "#9B9BAD",
          textAlign: "center",
          maxWidth: 240,
          lineHeight: 1.6,
        }}
      >
        Pick someone from the sidebar to start a private conversation.
      </p>
    </div>
  );
}

// Main Dashboard

export default function ChatDashboard() {
  const { currentUser, users, messages, sendDM, fetchHistory, markRead } =
    useSocket();
  const [activeChat, setActiveChat] = useState<string | null>(null);

  if (!currentUser) return null;

  const handleSelectChat = (peerUsername: string) => {
    setActiveChat(peerUsername);
    fetchHistory(peerUsername);
  };

  const handleSendDM = (content: string) => {
    if (!activeChat) return;
    sendDM(activeChat, content);
  };

  const handleMarkRead = () => {
    if (!activeChat) return;
    const channelId = getDMChannelId(currentUser, activeChat);
    markRead(channelId);
  };

  const activeChannelId = activeChat
    ? getDMChannelId(currentUser, activeChat)
    : null;
  const activeMessages = activeChannelId
    ? (messages[activeChannelId] ?? [])
    : [];
  const activePeerUser = activeChat
    ? users.find((u) => u.username === activeChat)
    : undefined;

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden" }}>
      <Sidebar
        users={users}
        currentUser={currentUser}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        messages={messages}
      />
      {activeChat ? (
        <ChatWindow
          peerUsername={activeChat}
          peerUser={activePeerUser}
          currentUser={currentUser}
          channelMessages={activeMessages}
          onSendDM={handleSendDM}
          onMarkRead={handleMarkRead}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
