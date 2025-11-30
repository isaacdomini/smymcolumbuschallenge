import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getAllDailyMessages, saveDailyMessage, deleteDailyMessage, DailyMessage } from '../../services/api';

const DailyMessageManager: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DailyMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
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
      await saveDailyMessage(user.id, { date, title, content });
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
    setTitle(msg.title);
    setContent(msg.content);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setDate('');
    setTitle('');
    setContent('');
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
            <div>
              <label className="block text-gray-400 mb-1 text-sm">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Verse of the Day"
                className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:border-yellow-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-400 mb-1 text-sm">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={4}
              placeholder="Enter the message content here..."
              className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:border-yellow-500 focus:outline-none"
            />
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
                    <h3 className="font-bold text-white">{msg.title}</h3>
                  </div>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{msg.content}</p>
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
