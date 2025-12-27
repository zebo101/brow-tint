'use client';

import Image from 'next/image';

export function TypingIndicator() {
  return (
    <div className="flex items-center justify-start py-4">
      <div className="relative w-16 h-16">
        <Image
          src="/imgs/bg/chat-d.gif"
          alt="Typing..."
          fill
          className="object-contain"
          unoptimized
        />
      </div>
    </div>
  );
}
