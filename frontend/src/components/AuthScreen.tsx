"use client";

import React, { useState, useCallback } from "react";

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
    <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[-60%] w-150 h-150 rounded-full pointer-events-none blur-2xl bg-[radial-gradient(circle,#E8E6FF80_0%,transparent_70%)]" />

      {/* Card */}
      <div className="bg-white rounded-[20px] p-10 w-full max-w-100 shadow-[0_4px_32px_rgba(108,99,255,0.08),0_1px_4px_rgba(0,0,0,0.04)] relative z-10">
        {/* Logo mark */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-[14px] bg-linear-to-br from-[#6C63FF] to-[#8B83FF] flex items-center justify-center">
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
        <h1 className="text-[22px] font-bold text-[#1A1A2E] text-center mb-1 tracking-[-0.3px]">
          {mode === "login" ? "Welcome back" : "Create an account"}
        </h1>
        <p className="text-sm text-[#9B9BAD] text-center mb-7">
          {mode === "login"
            ? "Sign in to continue messaging"
            : "Pick a username and get started"}
        </p>

        {/* Mode toggle tabs */}
        <div className="flex bg-[#F7F5F2] rounded-[10px] p-1 mb-6">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 p-2 rounded-lg border-none cursor-pointer text-sm transition-all duration-150 ease-in-out ${
                mode === m
                  ? "font-semibold text-[#6C63FF] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  : "font-normal text-[#9B9BAD] bg-transparent shadow-none"
              }`}
            >
              {m === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3">
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
          <div className="mt-4 py-2.5 px-3.5 bg-[#FEF2F2] border border-[#EF444422] rounded-lg text-[13px] text-[#EF4444]">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`mt-5 w-full p-3.25 rounded-xl border-none text-[15px] font-semibold text-white transition-opacity duration-150 ${
            loading
              ? "cursor-not-allowed bg-[#C2C2CE] opacity-70"
              : "cursor-pointer bg-linear-to-br from-[#6C63FF] to-[#8B83FF] opacity-100"
          }`}
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
        <p className="mt-4 text-center text-xs text-[#C2C2CE] flex items-center justify-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full inline-block ${
              isConnected ? "bg-green-500" : "bg-[#C2C2CE]"
            }`}
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
      <label className="block text-[13px] font-medium text-[#1A1A2E] mb-1.5">
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
        className={`w-full py-2.75 px-3.5 rounded-[10px] border-[1.5px] bg-[#F7F5F2] text-sm text-[#1A1A2E] outline-none transition-colors box-border ${
          focused ? "border-[#6C63FF]" : "border-[#EFEFEF]"
        }`}
      />
    </div>
  );
}
