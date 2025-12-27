'use client';

import { useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';

import { useChatContext } from '@/shared/contexts/chat';
import { Chat } from '@/shared/types/chat';

import { FollowUp } from './follow-up';
import { ChatHeader } from './header';
import { ChatMessages } from './messages';

export function ChatBox({
  initialChat,
  initialMessages,
}: {
  initialChat?: Chat;
  initialMessages?: UIMessage[];
}) {
  const { chat, setChat } = useChatContext();

  // create chat instance
  const chatInstance = useChat({
    id: initialChat?.id,
    messages: initialMessages,

    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest({ messages, id, body }) {
        const extraBody = body ?? {};
        return {
          body: {
            chatId: id,
            message: messages[messages.length - 1],
            ...extraBody,
          },
        };
      },
    }),
  });

  useEffect(() => {
    if (initialChat) {
      setChat(initialChat);
    }
  }, [initialChat]);

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden"
      style={{
        backgroundImage: 'url(/imgs/bg/2.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="bg-background/6 dark:bg-background/30 absolute inset-0" />
      <div className="relative z-10 flex h-screen flex-col overflow-hidden">
        <ChatHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full px-4 py-6 md:max-w-3xl">
            <ChatMessages chatInstance={chatInstance} />
          </div>
        </div>
        <div className="mx-auto w-full px-4 pb-4 md:max-w-3xl">
          <FollowUp chatInstance={chatInstance} />
        </div>
      </div>
    </div>
  );
}
