import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/services/api';

interface BannerMessage {
  id: number;
  content: string;
  type: 'system' | 'user';
  created_at: string;
}

export const BannerMessage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<BannerMessage[]>([]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await api.getBannerMessages();
        setMessages(data);
      } catch (error) {
        console.error('Failed to fetch banner messages', error);
      }
    };

    if (user) {
      fetchMessages();
    }
  }, [user]);

  const handleDismiss = async (id: number) => {
    try {
      await api.dismissBannerMessage(id);
      setMessages(prev => prev.filter(msg => msg.id !== id));
    } catch (error) {
      console.error('Failed to dismiss message', error);
    }
  };

  if (messages.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col gap-2 p-2 pointer-events-none">
      {messages.map(msg => (
        <div
          key={msg.id}
          className="pointer-events-auto bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex justify-between items-center max-w-4xl mx-auto w-full animate-fade-in-down"
        >
          <span className="font-medium">{msg.content}</span>
          <button
            onClick={() => handleDismiss(msg.id)}
            className="ml-4 text-blue-100 hover:text-white focus:outline-none"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};
