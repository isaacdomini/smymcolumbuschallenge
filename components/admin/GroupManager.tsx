
import React, { useState, useEffect } from 'react';
import { getGroups, createGroup, getGroupMembers, addUserToGroup, removeUserFromGroup } from '../../services/groups';
import { getUsers } from '../../services/api';
import { Group, User } from '../../types';

const GroupManager: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Member Management State
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadMembers(selectedGroup.id);
    } else {
      setMembers([]);
    }
  }, [selectedGroup]);

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const data = await getGroups();
      setGroups(data);
    } catch (err) {
      setError('Failed to load groups');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const data = await getGroupMembers(groupId);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members', err);
      // Don't set global error to avoid blocking UI
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      await createGroup(newGroupName);
      setNewGroupName('');
      setSuccess('Group created successfully');
      setTimeout(() => setSuccess(null), 3000);
      loadGroups();
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newUserEmail.trim()) return;

    try {
      setError(null);
      // 1. Find user by email (fetch all users if unknown - simple optimization for now)
      // Ideally backend handles email lookup, but for now we do client side lookup if needed
      // or we assume our backend helper `addUserToGroup` handles it.
      // Let's first try to find the user in a cached list or fetch them.
      // Since we don't have a search user by email API readily available here without big fetch,
      // let's fetch all users once if not loaded (or rely on what we have).
      // Actually, let's just fetch all users for now (scale < 1000).
      let targetUserId = '';

      // Optimization: Try to use existing logic or just fetch all users
      if (allUsers.length === 0) {
        // Assume this component is wrapped with user context that has ID
        // We need a userId to call getUsers. Let's assume we can get it from storage or fail.
        const storedUser = localStorage.getItem('user');
        let currentUserId = '';
        if (storedUser) currentUserId = JSON.parse(storedUser).id;

        if (currentUserId) {
          const users = await getUsers(currentUserId, 1000);
          setAllUsers(users);
          const found = users.find(u => u.email.toLowerCase() === newUserEmail.toLowerCase().trim());
          if (found) targetUserId = found.id;
        }
      } else {
        const found = allUsers.find(u => u.email.toLowerCase() === newUserEmail.toLowerCase().trim());
        if (found) targetUserId = found.id;
      }

      if (!targetUserId) {
        setError('User not found with that email. Make sure they have signed up.');
        return;
      }

      await addUserToGroup(selectedGroup.id, targetUserId);
      setNewUserEmail('');
      setSuccess('User added to group');
      setTimeout(() => setSuccess(null), 3000);
      loadMembers(selectedGroup.id);
    } catch (err: any) {
      setError(err.message || 'Failed to add user');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup || !confirm('Are you sure you want to remove this user from the group?')) return;

    try {
      await removeUserFromGroup(selectedGroup.id, userId);
      loadMembers(selectedGroup.id);
    } catch (err: any) {
      setError(err.message || 'Failed to remove user');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column: Group List & Creation */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 h-fit">
        <h2 className="text-xl font-bold text-white mb-6">Groups</h2>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900/50 border border-green-500 text-green-200 p-3 rounded mb-4 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleCreateGroup} className="mb-6 flex gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="New Group Name"
            className="flex-1 bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-yellow-500 text-sm"
          />
          <button
            type="submit"
            disabled={!newGroupName.trim()}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold px-4 py-2 rounded text-sm disabled:opacity-50 transition-colors"
          >
            Create
          </button>
        </form>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-4 text-gray-400">Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-4 text-gray-400 bg-gray-700/30 rounded">
              No groups found.
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className={`p-3 rounded border cursor-pointer transition-colors flex justify-between items-center ${selectedGroup?.id === group.id
                  ? 'bg-yellow-500/20 border-yellow-500'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                  }`}
              >
                <span className={`font-medium ${selectedGroup?.id === group.id ? 'text-yellow-500' : 'text-gray-200'}`}>
                  {group.name}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(group.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Member Management */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 h-fit">
        <h2 className="text-xl font-bold text-white mb-6">
          {selectedGroup ? `Members: ${selectedGroup.name}` : 'Select a Group'}
        </h2>

        {selectedGroup ? (
          <>
            <form onSubmit={handleAddMember} className="mb-6">
              <label className="block text-gray-400 text-xs mb-1">Add Member by Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-yellow-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={!newUserEmail.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded text-sm disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {loadingMembers ? (
                <div className="text-center py-4 text-gray-400">Loading members...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-gray-700/30 rounded">
                  No members in this group.
                </div>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="bg-gray-700/30 p-3 rounded flex justify-between items-center border border-gray-700">
                    <div>
                      <div className="text-white font-medium text-sm">{member.name}</div>
                      <div className="text-gray-400 text-xs">{member.email}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-400/10 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p>Select a group from the list to manage its members.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupManager;
