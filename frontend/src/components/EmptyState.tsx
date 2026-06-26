"use client";

export default function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#F7F5F2]">
      <div className="w-18 h-18 rounded-[22px] bg-linear-to-br from-[#6C63FF] to-[#9B8FFF] flex items-center justify-center mb-5 shadow-xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          width={36}
          height={36}
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[#1A1A2E] mb-2 tracking-[-0.3px]">
        Your messages
      </h2>
      <p className="text-[13.5px] text-[#9B9BAD] text-center max-w-60 leading-normal">
        Select a conversation or start a new chat to begin messaging.
      </p>
    </div>
  );
}
