import type { Metadata } from "next";
import "./globals.css";
import { SocketProvider } from "@/context/SocketContext";

export const metadata: Metadata = {
  title: "DM App",
  description: "Real-time 1-to-1 direct messaging",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SocketProvider>{children}</SocketProvider>
      </body>
    </html>
  );
}
