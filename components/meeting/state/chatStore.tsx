"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import type { ChatMessage } from '../../../types';
import { RateLimiter, BoundedArray } from '../../../lib/throttling';
import { trackEvent } from '../../../lib/monitoring';

type MeetingChatContextValue = {
  chatMessages: ChatMessage[];
  sendChatMessage: (message: string) => void;
  queueStatus: { queued: number; processing: boolean };
};

const MeetingChatContext = createContext<MeetingChatContextValue | null>(null);

// Throttling constants
const CHAT_RATE_LIMITER = new RateLimiter(100); // Max 100 messages/sec
const MESSAGE_HISTORY = new BoundedArray<ChatMessage>(500); // Keep last 500 messages

export function MeetingChatProvider({ children }: { children: ReactNode }) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageQueue, setMessageQueue] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Process queued messages periodically
  useEffect(() => {
    if (messageQueue.length === 0 || isProcessing) return;

    setIsProcessing(true);
    const timer = setTimeout(() => {
      setChatMessages(current => {
        const updated = [...current, ...messageQueue];
        setMessageQueue([]);
        setIsProcessing(false);
        return updated;
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [messageQueue, isProcessing]);

  const sendChatMessage = useCallback((message: string) => {
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).slice(2, 10),
      sender: 'You',
      message,
      timestamp: new Date().toISOString(),
    };

    // Apply rate limiting: if too many messages, queue them
    if (CHAT_RATE_LIMITER.allow()) {
      setChatMessages(current => {
        const updated = [...current, newMessage];
        MESSAGE_HISTORY.push(newMessage);
        // Monitoring: track chat message sent
        trackEvent({
          type: 'custom',
          name: 'chat_message_sent',
          data: { message: newMessage },
          timestamp: Date.now(),
        });
        return updated;
      });
    } else {
      // Queue message if rate limit exceeded
      setMessageQueue(current => {
        const updated = [...current, newMessage];
        // Monitoring: track buffer overflow if queue is too large
        if (updated.length > 500) {
          trackEvent({
            type: 'buffer_overflow',
            buffer: 'chat_message_queue',
            size: updated.length,
            timestamp: Date.now(),
          });
        }
        return updated;
      });
    }
  }, []);

  const value = useMemo(
    () => ({
      chatMessages,
      sendChatMessage,
      queueStatus: { queued: messageQueue.length, processing: isProcessing },
    }),
    [chatMessages, sendChatMessage, messageQueue.length, isProcessing]
  );

  return <MeetingChatContext.Provider value={value}>{children}</MeetingChatContext.Provider>;
}

export function useMeetingChat() {
  const context = useContext(MeetingChatContext);
  if (!context) {
    throw new Error('useMeetingChat must be used within MeetingChatProvider');
  }
  return context;
}
