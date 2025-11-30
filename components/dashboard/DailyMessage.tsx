import React from 'react';
import { DailyMessage as DailyMessageType } from '../../services/api';

interface DailyMessageProps {
  message: DailyMessageType | null;
  isBlurred: boolean;
}

const DailyMessage: React.FC<DailyMessageProps> = ({ message, isBlurred }) => {
  if (!message) return null;

  return (
    <div className="mb-8 bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700 relative">
      <div className="p-6 text-center">
        <h2 className={`text-2xl font-bold text-yellow-400 mb-4 ${isBlurred ? 'blur-sm select-none' : ''}`}>
          {message.title}
        </h2>
        <div className={`text-gray-300 text-lg leading-relaxed ${isBlurred ? 'blur-md select-none pointer-events-none' : ''}`}>
          {message.content.split('\n').map((line, i) => (
            <p key={i} className="mb-2">{line}</p>
          ))}
        </div>
      </div>

      {isBlurred && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-[2px]">
          <div className="bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-600 max-w-xs text-center">
            <span className="text-3xl mb-2 block">🔒</span>
            <p className="text-gray-300 font-medium">
              Complete today's game to unlock today's message!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyMessage;
