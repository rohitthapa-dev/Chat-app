"use client";

export default function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-[10px] bg-[#6C63FF] text-white text-[11px] font-bold leading-none shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}
