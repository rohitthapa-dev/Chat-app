"use client";

import React, { useState } from "react";
import { useSocket } from "@/context/SocketContext";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const { register, isConnected } = useSocket();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      register(username.trim());
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "#F7F5F2" }}
    >
      {/* Ambient orb behind card */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(108,99,255,0.13) 0%, transparent 70%)",
          pointerEvents: "none",
          filter: "blur(8px)",
        }}
      />

      <div
        className="relative w-full max-w-sm"
        style={{ filter: "drop-shadow(0 8px 32px rgba(108,99,255,0.10))" }}
      >
        {/* Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 20,
            padding: "40px 36px 36px",
            border: "1px solid rgba(108,99,255,0.12)",
          }}
        >
          {/* Logo mark */}
          <div className="flex justify-center mb-6">
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: "linear-gradient(135deg, #6C63FF 0%, #9B8FFF 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(108,99,255,0.30)",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="white"
                width={26}
                height={26}
              >
                <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
              </svg>
            </div>
          </div>

          <h1
            style={{
              textAlign: "center",
              fontSize: 22,
              fontWeight: 700,
              color: "#1A1A2E",
              marginBottom: 6,
              letterSpacing: "-0.3px",
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              textAlign: "center",
              fontSize: 13.5,
              color: "#9B9BAD",
              marginBottom: 28,
            }}
          >
            {isConnected ? (
              <span style={{ color: "#22c55e" }}>● Connected</span>
            ) : (
              <span>Connecting to server…</span>
            )}
          </p>

          <div style={{ marginBottom: 10 }}>
            <label
              style={{
                display: "block",
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "#9B9BAD",
                marginBottom: 7,
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit(e as never)}
              placeholder="e.g. Alex"
              autoFocus
              style={{
                width: "100%",
                padding: "11px 14px",
                fontSize: 14.5,
                color: "#1A1A2E",
                background: "#F7F5F2",
                border: "1.5px solid #E8E6FF",
                borderRadius: 10,
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#6C63FF")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E8E6FF")}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!username.trim()}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "12px",
              fontSize: 14.5,
              fontWeight: 600,
              color: "#fff",
              background: username.trim()
                ? "linear-gradient(135deg, #6C63FF 0%, #8B83FF 100%)"
                : "#C8C5F0",
              border: "none",
              borderRadius: 10,
              cursor: username.trim() ? "pointer" : "not-allowed",
              transition: "opacity 0.15s, transform 0.1s",
              boxShadow: username.trim()
                ? "0 4px 16px rgba(108,99,255,0.28)"
                : "none",
            }}
            onMouseEnter={(e) => {
              if (username.trim()) e.currentTarget.style.opacity = "0.88";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Start chatting
          </button>
        </div>

        {/* Subtle footnote */}
        <p
          style={{
            textAlign: "center",
            marginTop: 16,
            fontSize: 12,
            color: "#C2C2CE",
          }}
        >
          No account needed — just pick a name.
        </p>
      </div>
    </div>
  );
}
