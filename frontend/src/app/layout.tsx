import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DM App",
  description: "Real-time direct messaging",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
