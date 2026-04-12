import { ReactNode } from 'react';

import { ChatLayoutClient } from './chat-layout-client';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <ChatLayoutClient>{children}</ChatLayoutClient>;
}
