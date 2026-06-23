"use client";

import { useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { SocketProvider, useSocket } from "../context/SocketContext";
import AuthScreen from "../components/AuthScreen";
import ChatDashboard from "../components/ChatDashboard";

// Inner component — has access to SocketProvider context

function AppInner() {
  const { user, isAuthenticated, register, login, logout } = useAuth();
  const { isConnected } = useSocket();

  if (!isAuthenticated || !user) {
    return (
      <AuthScreen
        onRegister={register}
        onLogin={login}
        isConnected={isConnected}
      />
    );
  }

  return <ChatDashboard currentUser={user.username} onLogout={logout} />;
}

// Root page

export default function Page() {
  const { token, user, logout } = useAuth();

  const handleAuthError = useCallback(() => {
    logout();
  }, [logout]);

  return (
    <SocketProvider
      token={token}
      currentUsername={user?.username ?? null}
      onAuthError={handleAuthError}
    >
      <AppInner />
    </SocketProvider>
  );
}
