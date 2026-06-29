"use client";

import { getInitials } from "@/utils/chat";

export default function UserAvatar({
  name,
  isOnline,
  size = "md",
}: {
  name: string;
  isOnline: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: {
      box: "w-8.5 h-8.5",
      font: "text-[11px]",
      dot: "w-2 h-2",
      border: "border-2",
    },
    md: {
      box: "w-10.5 h-10.5",
      font: "text-[13px]",
      dot: "w-2.5 h-2.5",
      border: "border-2",
    },
    lg: {
      box: "w-13 h-13",
      font: "text-[15px]",
      dot: "w-3 h-3",
      border: "border-2",
    },
  };
  const s = sizes[size];

  const hue =
    name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  return (
    <div className="relative shrink-0">
      <div
        className={`${s.box} rounded-full flex items-center justify-center font-bold ${s.font} text-white tracking-[0.03em] select-none`}
        style={{
          background: `linear-gradient(135deg, hsl(${hue},60%,62%) 0%, hsl(${hue},50%,50%) 100%)`,
        }}
      >
        {getInitials(name)}
      </div>
      <span
        className={`absolute bottom-0 right-0 ${s.dot} rounded-full ${isOnline ? "bg-green-500" : "bg-slate-300"} ${s.border} border-white`}
      />
    </div>
  );
}
