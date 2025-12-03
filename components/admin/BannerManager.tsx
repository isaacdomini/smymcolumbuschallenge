import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../services/api';
import { User } from '../../types';

const BannerManager: React.FC = () => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [type, setType] = useState<'system' | 'user'>('system');
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (type === 'user') {
      loadUsers();
    }
  }, [type]);

  const loadUsers = async () => {
    try {
      if (user?.id) {
        const data = await api.getUsers(user.id, 1000); // Fetch enough users for selection
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      if (user?.id) {
        await api.createBannerMessage(user.id, {
          content,
          type,
          targetUserIds: type === 'user' ? targetUserIds : undefined,
          expiresAt: expiresAt || undefined,
          linkUrl: linkUrl || undefined
        });
        setMessage({ text: 'Banner message created successfully!', type: 'success' });
        setContent('');
        setTargetUserIds([]);
        setExpiresAt('');
        setLinkUrl('');
      }
    } catch (error) {
      setMessage({ text: 'Failed to create banner message.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setTargetUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-6">Create Banner Message</h2>

      {message && (
        <div className={`p-4 rounded mb-4 ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-300 mb-2">Message Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            rows={3}
            required
            placeholder="Enter your message here..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-300 mb-2">Message Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'system' | 'user')}
              className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="system">System Wide (All Users)</option>
              <option value="user">Targeted (Specific Users)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Expires At (Optional)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-300 mb-2">Link URL (Optional)</label>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>

        {type === 'user' && (
          <div className="border border-gray-700 rounded p-4">
            <label className="block text-gray-300 mb-2">Select Target Users ({targetUserIds.length} selected)</label>
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 text-white rounded p-2 mb-4"
            />
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredUsers.map(u => (
                <div
                  key={u.id}
                  onClick={() => toggleUserSelection(u.id)}
                  className={`p-2 rounded cursor-pointer flex justify-between items-center ${targetUserIds.includes(u.id) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                >
                  <span>{u.name} ({u.email})</span>
                  {targetUserIds.includes(u.id) && <span>✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-6 rounded transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Message'}
        </button>
      </form>
    </div>
  );
};

export default BannerManager;
