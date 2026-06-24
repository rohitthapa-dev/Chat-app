"use client";

import React, { useState, useCallback } from "react";

// ─── Design tokens (same system as LoginScreen) ───────────────────────────────
const T = {
  bg: "#F7F5F2",
  white: "#FFFFFF",
  accent: "#6C63FF",
  accentLight: "#8B83FF",
  accentTint: "#E8E6FF",
  textPrimary: "#1A1A2E",
  textMuted: "#9B9BAD",
  textSubtle: "#C2C2CE",
  divider: "#EFEFEF",
  error: "#EF4444",
  errorBg: "#FEF2F2",
};

interface AuthScreenProps {
  onRegister: (username: string, password: string) => Promise<void>;
  onLogin: (username: string, password: string) => Promise<void>;
  isConnected: boolean;
}

type Mode = "login" | "signup";

const MIN_USERNAME = 3;
const MAX_USERNAME = 20;
const MIN_PASSWORD = 6;

function validate(
  mode: Mode,
  username: string,
  password: string,
  confirm: string,
): string | null {
  if (!username.trim()) return "Username is required";
  if (username.trim().length < MIN_USERNAME)
    return `Username must be at least ${MIN_USERNAME} characters`;
  if (username.trim().length > MAX_USERNAME)
    return `Username must be under ${MAX_USERNAME} characters`;
  if (!password) return "Password is required";
  if (password.length < MIN_PASSWORD)
    return `Password must be at least ${MIN_PASSWORD} characters`;
  if (mode === "signup" && password !== confirm)
    return "Passwords do not match";
  return null;
}

export default function AuthScreen({
  onRegister,
  onLogin,
  isConnected,
}: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirm("");
  }, []);

  const handleSubmit = useCallback(async () => {
    const validationError = validate(mode, username, password, confirm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        await onRegister(username.trim().toLowerCase(), password);
      } else {
        await onLogin(username.trim().toLowerCase(), password);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [mode, username, password, confirm, onRegister, onLogin]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSubmit();
    },
    [handleSubmit],
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient orb */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -60%)",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${T.accentTint}80 0%, transparent 70%)`,
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        style={{
          backgroundColor: T.white,
          borderRadius: "20px",
          padding: "40px",
          width: "100%",
          maxWidth: "400px",
          boxShadow:
            "0 4px 32px rgba(108, 99, 255, 0.08), 0 1px 4px rgba(0,0,0,0.04)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"
                fill="white"
                fillOpacity="0.9"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: T.textPrimary,
            textAlign: "center",
            marginBottom: "4px",
            letterSpacing: "-0.3px",
          }}
        >
          {mode === "login" ? "Welcome back" : "Create an account"}
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: T.textMuted,
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          {mode === "login"
            ? "Sign in to continue messaging"
            : "Pick a username and get started"}
        </p>

        {/* Mode toggle tabs */}
        <div
          style={{
            display: "flex",
            backgroundColor: T.bg,
            borderRadius: "10px",
            padding: "4px",
            marginBottom: "24px",
          }}
        >
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: mode === m ? 600 : 400,
                color: mode === m ? T.accent : T.textMuted,
                backgroundColor: mode === m ? T.white : "transparent",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {m === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Field
            label="Username"
            type="text"
            value={username}
            placeholder="e.g. rohit_dev"
            onChange={setUsername}
            onKeyDown={handleKey}
            autoFocus
          />
          <Field
            label="Password"
            type="password"
            value={password}
            placeholder="At least 6 characters"
            onChange={setPassword}
            onKeyDown={handleKey}
          />
          {mode === "signup" && (
            <Field
              label="Confirm password"
              type="password"
              value={confirm}
              placeholder="Repeat your password"
              onChange={setConfirm}
              onKeyDown={handleKey}
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginTop: "16px",
              padding: "10px 14px",
              backgroundColor: T.errorBg,
              border: `1px solid ${T.error}22`,
              borderRadius: "8px",
              fontSize: "13px",
              color: T.error,
            }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            marginTop: "20px",
            width: "100%",
            padding: "13px",
            borderRadius: "12px",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "15px",
            fontWeight: 600,
            color: "#FFFFFF",
            background: loading
              ? T.textSubtle
              : `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`,
            transition: "opacity 0.15s ease",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? mode === "login"
              ? "Signing in…"
              : "Creating account…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        {/* Connection status */}
        <p
          style={{
            marginTop: "16px",
            textAlign: "center",
            fontSize: "12px",
            color: T.textSubtle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: isConnected ? "#22c55e" : T.textSubtle,
              display: "inline-block",
            }}
          />
          {isConnected ? "Server connected" : "Connecting to server…"}
        </p>
      </div>
    </div>
  );
}

// ─── Field sub-component ──────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  type: string;
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  autoFocus?: boolean;
}

function Field({
  label,
  type,
  value,
  placeholder,
  onChange,
  onKeyDown,
  autoFocus,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: "13px",
          fontWeight: 500,
          color: "#1A1A2E",
          marginBottom: "6px",
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "11px 14px",
          borderRadius: "10px",
          border: `1.5px solid ${focused ? "#6C63FF" : "#EFEFEF"}`,
          backgroundColor: "#F7F5F2",
          fontSize: "14px",
          color: "#1A1A2E",
          outline: "none",
          transition: "border-color 0.15s ease",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
