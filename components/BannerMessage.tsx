import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/services/api';
import ReactMarkdown from 'react-markdown';

interface BannerMessage {
  id: number;
  content: string;
  type: 'system' | 'user';
  linkUrl?: string;
  linkText?: string;
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
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto mb-8">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`relative bg-gray-800 border-l-4 border-yellow-500 text-white px-6 py-4 rounded-lg shadow-lg flex justify-between items-center w-full animate-fade-in-down ${msg.linkUrl ? 'cursor-pointer hover:bg-gray-700 transition-colors' : ''}`}
          onClick={() => {
            if (msg.linkUrl) {
              window.open(msg.linkUrl, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          <div className="flex-1 pr-8">
            <div className="font-medium text-lg prose prose-invert prose-p:my-0 prose-a:text-yellow-400 prose-ul:list-disc prose-ul:pl-5 prose-li:my-0 [&_li::marker]:text-white">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
            {msg.linkUrl && (
              <span className="inline-block mt-2 text-yellow-400 text-sm font-semibold hover:text-yellow-300 transition-colors">
                {msg.linkText || 'Learn more'} &rarr;
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss(msg.id);
            }}
            className="absolute top-2 right-2 p-2 text-blue-100 hover:text-white focus:outline-none hover:bg-blue-500 rounded-full transition-colors"
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
