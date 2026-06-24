"use client";

import AuthScreen from "./AuthScreen";

interface LoginScreenProps {
  onRegister: (username: string, password: string) => Promise<void>;
  onLogin: (username: string, password: string) => Promise<void>;
  isConnected: boolean;
}

export default function LoginScreen(props: LoginScreenProps) {
  return <AuthScreen {...props} />;
}
