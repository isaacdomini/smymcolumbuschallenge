
import React, { useState, useEffect, useCallback } from 'react';
import { getPublicGroups, joinGroup, joinPublicGroup, leaveGroup } from '../services/groups';
import { useGroup } from './GroupContext';
import { PublicGroup, Group } from '../types';

interface GroupBrowserProps {
  onBack: () => void;
  navigate: (path: string) => void;
}

const GroupBrowser: React.FC<GroupBrowserProps> = ({ onBack, navigate }) => {
  const { userGroups, refreshGroups, setCurrentGroup } = useGroup();

  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);
  const [search, setSearch] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPublicGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const groups = await getPublicGroups(search || undefined);
      setPublicGroups(groups);
    } catch (err) {
      console.error('Failed to load public groups', err);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => loadPublicGroups(), 300);
    return () => clearTimeout(timer);
  }, [loadPublicGroups]);

  const showMessage = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccess(msg);
      setError(null);
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setError(msg);
      setSuccess(null);
    }
  };

  const handleJoinPublic = async (groupId: string) => {
    setActionLoading(groupId);
    try {
      const result = await joinPublicGroup(groupId);
      showMessage(`Joined "${result.groupName}" successfully!`, 'success');
      await refreshGroups();
      loadPublicGroups();
    } catch (err: any) {
      showMessage(err.message || 'Failed to join group', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setActionLoading('invite');
    try {
      const result = await joinGroup(inviteCode.trim());
      showMessage(`Joined "${result.groupName}" successfully!`, 'success');
      setInviteCode('');
      await refreshGroups();
      loadPublicGroups();
    } catch (err: any) {
      showMessage(err.message || 'Invalid invite code', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to leave "${groupName}"?`)) return;

    setActionLoading(groupId);
    try {
      await leaveGroup(groupId);
      showMessage(`Left "${groupName}"`, 'success');
      await refreshGroups();
      loadPublicGroups();
    } catch (err: any) {
      showMessage(err.message || 'Failed to leave group', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSwitchGroup = (group: Group & { role: string }) => {
    setCurrentGroup(group);
    localStorage.setItem('selectedGroupId', group.id);
    navigate('/');
    window.location.reload();
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-white">Groups</h1>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-4 text-sm animate-fade-in">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/50 border border-green-500 text-green-200 p-3 rounded-lg mb-4 text-sm animate-fade-in">
          {success}
        </div>
      )}

      {/* Join by Invite Code */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-6">
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Have an Invite Code?
        </h2>
        <form onSubmit={handleJoinByCode} className="flex gap-2">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Enter invite code..."
            className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 text-sm"
          />
          <button
            type="submit"
            disabled={!inviteCode.trim() || actionLoading === 'invite'}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold px-6 py-3 rounded-lg text-sm disabled:opacity-50 transition-all hover:scale-105"
          >
            {actionLoading === 'invite' ? 'Joining...' : 'Join'}
          </button>
        </form>
      </div>

      {/* My Groups */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          My Groups
        </h2>
        {userGroups.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center text-gray-400">
            You haven't joined any groups yet. Browse below or use an invite code!
          </div>
        ) : (
          <div className="space-y-2">
            {userGroups.map((group) => (
              <div key={group.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between hover:border-gray-600 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{group.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${group.role === 'admin' ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-600/50' : 'bg-gray-600/30 text-gray-400 border border-gray-600/50'}`}>
                      {group.role}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <button
                    onClick={() => handleSwitchGroup(group)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
                  >
                    Switch
                  </button>
                  {group.id !== 'default' && (
                    <button
                      onClick={() => handleLeaveGroup(group.id, group.name)}
                      disabled={actionLoading === group.id}
                      className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 rounded hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === group.id ? '...' : 'Leave'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Browse Public Groups */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Browse Public Groups
        </h2>

        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 text-sm"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading groups...</div>
        ) : publicGroups.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center text-gray-400">
            {search ? 'No groups found matching your search.' : 'No public groups available.'}
          </div>
        ) : (
          <div className="space-y-2">
            {publicGroups.map((group) => (
              <div key={group.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between hover:border-gray-600 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-white font-medium">{group.name}</span>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex-shrink-0 ml-3">
                  {group.isMember ? (
                    <span className="text-xs text-green-400 font-bold px-3 py-1.5 bg-green-600/20 rounded border border-green-600/50">
                      ✓ Joined
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoinPublic(group.id)}
                      disabled={actionLoading === group.id}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-1.5 rounded transition-all hover:scale-105 disabled:opacity-50"
                    >
                      {actionLoading === group.id ? 'Joining...' : 'Join'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupBrowser;
