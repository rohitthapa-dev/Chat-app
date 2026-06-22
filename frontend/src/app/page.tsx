"use client";

import { useSocket } from "@/context/SocketContext";
import LoginScreen from "@/components/LoginScreen";
import ChatDashboard from "@/components/ChatDashboard";

export default function Home() {
  const { currentUser } = useSocket();

  if (!currentUser) {
    return <LoginScreen />;
  }

  return <ChatDashboard />;
}
