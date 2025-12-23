import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getAllDailyMessages, saveDailyMessage, deleteDailyMessage, DailyMessage } from '../../services/api';
import { DailyMessageBlock, DailyMessageContent } from '../../types';

const DailyMessageManager: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DailyMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [date, setDate] = useState('');
  const [blocks, setBlocks] = useState<DailyMessageContent>([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [user]);

  const fetchMessages = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getAllDailyMessages(user.id);
      setMessages(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setSuccess(null);

    try {
      await saveDailyMessage(user.id, { date, content: JSON.stringify(blocks) });
      setSuccess('Message saved successfully');
      fetchMessages();
      resetForm();
    } catch (err) {
      console.error(err);
      setError('Failed to save message');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this message?')) return;

    try {
      await deleteDailyMessage(user.id, id);
      setSuccess('Message deleted successfully');
      fetchMessages();
    } catch (err) {
      console.error(err);
      setError('Failed to delete message');
    }
  };

  const handleEdit = (msg: DailyMessage) => {
    setDate(msg.date);
    try {
      const parsed = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
      if (Array.isArray(parsed)) {
        setBlocks(parsed);
      } else {
        setBlocks([{ type: 'paragraph', text: String(msg.content) }]);
      }
    } catch (e) {
      setBlocks([{ type: 'paragraph', text: String(msg.content) }]);
    }
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setDate('');
    setBlocks([]);
    setIsEditing(false);
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">
          {isEditing ? 'Edit Daily Message' : 'Create Daily Message'}
        </h2>

        {error && <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-900/50 text-green-200 p-3 rounded mb-4">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 mb-1 text-sm">Date (YYYY-MM-DD)</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:border-yellow-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-gray-400 text-sm">Content Blocks</label>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => setBlocks([...blocks, { type: 'paragraph', text: '' }])}
                  className="bg-gray-700 hover:bg-gray-600 text-xs text-white px-3 py-1 rounded"
                >
                  + Paragraph
                </button>
                <button
                  type="button"
                  onClick={() => setBlocks([...blocks, { type: 'verse', text: '', reference: '' }])}
                  className="bg-gray-700 hover:bg-gray-600 text-xs text-white px-3 py-1 rounded"
                >
                  + Verse
                </button>
                <button
                  type="button"
                  onClick={() => setBlocks([...blocks, { type: 'long_text', title: '', text: '' }])}
                  className="bg-gray-700 hover:bg-gray-600 text-xs text-white px-3 py-1 rounded"
                >
                  + Long Text
                </button>
              </div>
            </div>

            {blocks.map((block, index) => (
              <div key={index} className="bg-gray-900/50 p-4 rounded border border-gray-700 relative group">
                <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => {
                      if (index > 0) {
                        const newBlocks = [...blocks];
                        [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
                        setBlocks(newBlocks);
                      }
                    }}
                    disabled={index === 0}
                    className="text-gray-400 hover:text-white p-1 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (index < blocks.length - 1) {
                        const newBlocks = [...blocks];
                        [newBlocks[index + 1], newBlocks[index]] = [newBlocks[index], newBlocks[index + 1]];
                        setBlocks(newBlocks);
                      }
                    }}
                    disabled={index === blocks.length - 1}
                    className="text-gray-400 hover:text-white p-1 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlocks(blocks.filter((_, i) => i !== index))}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    ×
                  </button>
                </div>

                {(() => {
                  if (block.type === 'paragraph') {
                    return (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Paragraph (Markdown supported)</label>
                        <textarea
                          value={block.text}
                          onChange={(e) => {
                            const newBlocks = [...blocks];
                            if (newBlocks[index].type === 'paragraph') {
                              newBlocks[index].text = e.target.value;
                              setBlocks(newBlocks);
                            }
                          }}
                          rows={3}
                          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-yellow-500 focus:outline-none"
                          placeholder="Enter paragraph text..."
                        />
                      </div>
                    );
                  } else if (block.type === 'verse') {
                    return (
                      <div className="space-y-2">
                        <label className="text-xs text-yellow-500/70 mb-1 block">Verse</label>
                        <textarea
                          value={block.text}
                          onChange={(e) => {
                            const newBlocks = [...blocks];
                            if (newBlocks[index].type === 'verse') {
                              newBlocks[index].text = e.target.value;
                              setBlocks(newBlocks);
                            }
                          }}
                          rows={2}
                          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white italic focus:border-yellow-500 focus:outline-none"
                          placeholder="Enter verse text..."
                        />
                        <input
                          type="text"
                          value={block.reference}
                          onChange={(e) => {
                            const newBlocks = [...blocks];
                            if (newBlocks[index].type === 'verse') {
                              newBlocks[index].reference = e.target.value;
                              setBlocks(newBlocks);
                            }
                          }}
                          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm focus:border-yellow-500 focus:outline-none"
                          placeholder="Reference (e.g. John 3:16)"
                        />
                      </div>
                    );
                  } else {
                    return (
                      <div className="space-y-2">
                        <label className="text-xs text-blue-400 mb-1 block">Long Text (Link)</label>
                        <input
                          type="text"
                          value={block.title}
                          onChange={(e) => {
                            const newBlocks = [...blocks];
                            if (newBlocks[index].type === 'long_text') {
                              newBlocks[index].title = e.target.value;
                              setBlocks(newBlocks);
                            }
                          }}
                          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white font-bold focus:border-yellow-500 focus:outline-none"
                          placeholder="Title (e.g. Daily Reflection)"
                        />
                        <textarea
                          value={block.text}
                          onChange={(e) => {
                            const newBlocks = [...blocks];
                            if (newBlocks[index].type === 'long_text') {
                              newBlocks[index].text = e.target.value;
                              setBlocks(newBlocks);
                            }
                          }}
                          rows={5}
                          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-yellow-500 focus:outline-none font-mono text-sm"
                          placeholder="Enter long text content (Markdown supported)..."
                        />
                      </div>
                    );
                  }
                })()}
              </div>
            ))}

            {blocks.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-700 rounded-lg text-gray-500">
                No content blocks. Add a paragraph, verse, or long text to start.
              </div>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-6 rounded transition-colors"
            >
              {isEditing ? 'Update Message' : 'Save Message'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">Existing Messages</h2>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No messages found.</div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="bg-gray-700/50 p-4 rounded border border-gray-600 flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded font-mono">
                      {msg.date}
                    </span>
                  </div>
                  <div className="text-gray-300 text-sm line-clamp-2">
                    {(() => {
                      try {
                        const parsed = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
                        if (Array.isArray(parsed)) {
                          return parsed.map(b => b.text).join(' ');
                        }
                        return String(msg.content);
                      } catch {
                        return String(msg.content);
                      }
                    })()}
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleEdit(msg)}
                    className="text-blue-400 hover:text-blue-300 p-1"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="text-red-400 hover:text-red-300 p-1"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyMessageManager;
