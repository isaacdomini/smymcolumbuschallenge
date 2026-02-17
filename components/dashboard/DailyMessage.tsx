import React from 'react';
import { DailyMessage as DailyMessageType } from '../../services/api';
import ReactMarkdown from 'react-markdown';

interface DailyMessageProps {
  message: DailyMessageType | null;
  isBlurred: boolean;
  navigate: (path: string, state?: any) => void;
}

const DailyMessage: React.FC<DailyMessageProps> = ({ message, isBlurred, navigate }) => {
  if (!message) return null;

  return (
    <div className="mb-8 bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700 relative">
      <div className="p-6 text-left">
        <div className={`text-gray-300 text-lg leading-relaxed ${isBlurred ? 'blur-md select-none pointer-events-none' : ''}`}>
          {(() => {
            try {
              const blocks = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
              if (Array.isArray(blocks)) {
                return blocks.map((block: any, i: number) => {
                  if (block.type === 'verse') {
                    return (
                      <div key={i}>
                        <div className="mb-4 px-4 border-l-4 border-yellow-500/50 bg-gray-900/30 py-2 rounded-r">
                          <p className="font-serif italic text-xl text-yellow-100 mb-1">"{block.text}"</p>
                          <p className="text-sm text-yellow-500 font-bold text-right">— {block.reference}</p>
                        </div>
                      </div>
                    );
                  } else if (block.type === 'long_text') {
                    return (
                      <div key={i} className="mb-4">
                        <button
                          onClick={() => navigate(`/message-viewer?date=${message.date}&title=${encodeURIComponent(block.title)}`, { title: block.title, text: block.text, date: message.date, pdfUrl: block.pdfUrl })}
                          className="w-full text-left bg-gray-700 hover:bg-gray-600 transition-colors p-4 rounded-lg border border-gray-600 group"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-blue-300 group-hover:text-blue-200 text-lg">📄 {block.title}</span>
                            <span className="text-gray-400 group-hover:text-white">Read & Download →</span>
                          </div>
                        </button>
                      </div>
                    )
                  } else if (block.type === 'youtube') {
                    const getYouTubeId = (url: string) => {
                      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                      const match = url.match(regExp);
                      return (match && match[2].length === 11) ? match[2] : null;
                    };
                    const videoId = getYouTubeId(block.url);

                    return (
                      <div key={i} className="mb-6">
                        {videoId ? (
                          <div className="relative w-full pb-[56.25%] overflow-hidden rounded-lg border border-gray-700 shadow-lg bg-black">
                            <iframe
                              className="absolute top-0 left-0 w-full h-full"
                              src={`https://www.youtube.com/embed/${videoId}`}
                              title={block.caption || "YouTube video player"}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            ></iframe>
                          </div>
                        ) : (
                          <div className="p-4 bg-red-900/30 text-red-200 rounded border border-red-800 text-sm">
                            Invalid YouTube URL
                          </div>
                        )}
                        {block.caption && (
                          <p className="mt-2 text-sm text-gray-400 italic text-center">{block.caption}</p>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div key={i} className="mb-4 text-gray-300 markdown-content">
                        <ReactMarkdown
                          components={{
                            a: ({ node, ...props }) => <a {...props} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" />,
                            p: ({ node, ...props }) => <p {...props} className="mb-2" />
                          }}
                        >
                          {block.text}
                        </ReactMarkdown>
                      </div>
                    );
                  }
                });
              }
              // If it's not an array, maybe it's old text content that got json-encoded as a string?
              // Or just fallback to displaying it.
              return <p className="mb-4 text-gray-300">{String(message.content)}</p>;
            } catch (e) {
              // Fallback for old plain text format
              return String(message.content).split('\n').map((line, i) => (
                <p key={i} className="mb-2">{line}</p>
              ));
            }
          })()}
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
