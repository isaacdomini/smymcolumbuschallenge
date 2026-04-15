
import React, { useState, useEffect } from 'react';
import { getGroups, createGroup, getGroupMembers, addUserToGroup, removeUserFromGroup, updateMemberRole, updateGroup, createInvite, getInvites, revokeInvite } from '../../services/groups';
import { getUsers } from '../../services/api';
import { Group, User, GroupInvite } from '../../types';
import { useAuth } from '../../hooks/useAuth';

const GroupManager: React.FC = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPublic, setNewGroupPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Member Management State
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Invite State
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteMaxUses, setInviteMaxUses] = useState('');
  const [inviteExpiresHours, setInviteExpiresHours] = useState('');
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Tab for right panel
  const [rightTab, setRightTab] = useState<'members' | 'invites'>('members');

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadMembers(selectedGroup.id);
      loadInvites(selectedGroup.id);
    } else {
      setMembers([]);
      setInvites([]);
    }
  }, [selectedGroup]);

  const showMessage = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccess(msg);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(msg);
      setSuccess(null);
    }
  };

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const data = await getGroups();
      setGroups(data);
    } catch (err) {
      showMessage('Failed to load groups', 'error');
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
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadInvites = async (groupId: string) => {
    setLoadingInvites(true);
    try {
      const data = await getInvites(groupId);
      setInvites(data);
    } catch (err) {
      console.error('Failed to load invites', err);
    } finally {
      setLoadingInvites(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      await createGroup(newGroupName, newGroupPublic);
      setNewGroupName('');
      setNewGroupPublic(false);
      showMessage('Group created successfully', 'success');
      loadGroups();
    } catch (err: any) {
      showMessage(err.message || 'Failed to create group', 'error');
    }
  };

  const handleTogglePublic = async (group: Group) => {
    try {
      await updateGroup(group.id, { isPublic: !group.isPublic });
      showMessage(`Group is now ${group.isPublic ? 'private' : 'public'}`, 'success');
      loadGroups();
      if (selectedGroup?.id === group.id) {
        setSelectedGroup({ ...group, isPublic: !group.isPublic });
      }
    } catch (err: any) {
      showMessage(err.message || 'Failed to update group', 'error');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newUserEmail.trim()) return;

    try {
      setError(null);
      let targetUserId = '';

      if (allUsers.length === 0) {
        const currentUserId = user?.id || '';

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
        showMessage('User not found with that email. Make sure they have signed up.', 'error');
        return;
      }

      await addUserToGroup(selectedGroup.id, targetUserId);
      setNewUserEmail('');
      showMessage('User added to group', 'success');
      loadMembers(selectedGroup.id);
    } catch (err: any) {
      showMessage(err.message || 'Failed to add user', 'error');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup || !confirm('Are you sure you want to remove this user from the group?')) return;

    try {
      await removeUserFromGroup(selectedGroup.id, userId);
      loadMembers(selectedGroup.id);
      showMessage('Member removed', 'success');
    } catch (err: any) {
      showMessage(err.message || 'Failed to remove user', 'error');
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (!selectedGroup) return;
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await updateMemberRole(selectedGroup.id, userId, newRole as 'member' | 'admin');
      loadMembers(selectedGroup.id);
      showMessage(`Role updated to ${newRole}`, 'success');
    } catch (err: any) {
      showMessage(err.message || 'Failed to update role', 'error');
    }
  };

  const handleCreateInvite = async () => {
    if (!selectedGroup) return;

    try {
      const options: { maxUses?: number; expiresInHours?: number } = {};
      if (inviteMaxUses.trim()) options.maxUses = parseInt(inviteMaxUses);
      if (inviteExpiresHours.trim()) options.expiresInHours = parseInt(inviteExpiresHours);

      await createInvite(selectedGroup.id, options);
      setInviteMaxUses('');
      setInviteExpiresHours('');
      showMessage('Invite created', 'success');
      loadInvites(selectedGroup.id);
    } catch (err: any) {
      showMessage(err.message || 'Failed to create invite', 'error');
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!selectedGroup || !confirm('Revoke this invite link?')) return;

    try {
      await revokeInvite(selectedGroup.id, inviteId);
      showMessage('Invite revoked', 'success');
      loadInvites(selectedGroup.id);
    } catch (err: any) {
      showMessage(err.message || 'Failed to revoke invite', 'error');
    }
  };

  const copyInviteUrl = (code: string, inviteId: string) => {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedInviteId(inviteId);
      setTimeout(() => setCopiedInviteId(null), 2000);
    });
  };

  const isInviteExpired = (invite: GroupInvite) => {
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return true;
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) return true;
    return false;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <form onSubmit={handleCreateGroup} className="mb-6 space-y-2">
          <div className="flex gap-2">
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
          </div>
          <label className="flex items-center gap-2 text-gray-400 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={newGroupPublic}
              onChange={(e) => setNewGroupPublic(e.target.checked)}
              className="rounded"
            />
            Make group public (discoverable by all users)
          </label>
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
                className={`p-3 rounded border cursor-pointer transition-colors ${selectedGroup?.id === group.id
                  ? 'bg-yellow-500/20 border-yellow-500'
                  : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${selectedGroup?.id === group.id ? 'text-yellow-500' : 'text-gray-200'}`}>
                      {group.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${group.isPublic ? 'bg-green-600/30 text-green-400 border border-green-600/50' : 'bg-gray-600/30 text-gray-400 border border-gray-600/50'}`}>
                      {group.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTogglePublic(group); }}
                    className={`text-[10px] px-2 py-1 rounded transition-colors ${group.isPublic ? 'bg-gray-600/50 hover:bg-gray-600 text-gray-300' : 'bg-green-600/30 hover:bg-green-600/50 text-green-400'}`}
                    title={group.isPublic ? 'Make Private' : 'Make Public'}
                  >
                    {group.isPublic ? 'Make Private' : 'Make Public'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Member/Invite Management */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 h-fit">
        {selectedGroup ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white truncate">{selectedGroup.name}</h2>
              {/* Tab Switcher */}
              <div className="flex bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => setRightTab('members')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${rightTab === 'members' ? 'bg-yellow-500 text-gray-900' : 'text-gray-400 hover:text-white'}`}
                >
                  Members ({members.length})
                </button>
                <button
                  onClick={() => setRightTab('invites')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${rightTab === 'invites' ? 'bg-yellow-500 text-gray-900' : 'text-gray-400 hover:text-white'}`}
                >
                  Invites ({invites.length})
                </button>
              </div>
            </div>

            {/* MEMBERS TAB */}
            {rightTab === 'members' && (
              <>
                <form onSubmit={handleAddMember} className="mb-4">
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm truncate">{member.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${member.role === 'admin' ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-600/50' : 'bg-gray-600/30 text-gray-400 border border-gray-600/50'}`}>
                              {member.role}
                            </span>
                          </div>
                          <div className="text-gray-400 text-xs truncate">{member.email}</div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => handleToggleRole(member.id, member.role)}
                            className="text-xs px-2 py-1 rounded transition-colors bg-gray-600/50 hover:bg-gray-600 text-gray-300"
                            title={member.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                          >
                            {member.role === 'admin' ? '↓ Demote' : '↑ Promote'}
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-400/10 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* INVITES TAB */}
            {rightTab === 'invites' && (
              <>
                <div className="mb-4 space-y-2">
                  <label className="block text-gray-400 text-xs">Generate Invite Link</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={inviteMaxUses}
                      onChange={(e) => setInviteMaxUses(e.target.value)}
                      placeholder="Max uses (blank=∞)"
                      min="1"
                      className="flex-1 bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-yellow-500 text-sm"
                    />
                    <input
                      type="number"
                      value={inviteExpiresHours}
                      onChange={(e) => setInviteExpiresHours(e.target.value)}
                      placeholder="Expires in hours (blank=never)"
                      min="1"
                      className="flex-1 bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-yellow-500 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleCreateInvite}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
                  >
                    🔗 Generate Invite Link
                  </button>
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {loadingInvites ? (
                    <div className="text-center py-4 text-gray-400">Loading invites...</div>
                  ) : invites.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 bg-gray-700/30 rounded">
                      No invites yet. Generate one above.
                    </div>
                  ) : (
                    invites.map((invite) => {
                      const expired = isInviteExpired(invite);
                      return (
                        <div key={invite.id} className={`p-3 rounded border ${expired ? 'bg-gray-800/50 border-gray-700 opacity-60' : 'bg-gray-700/30 border-gray-700'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <code className="text-yellow-400 font-mono text-sm bg-gray-900 px-2 py-1 rounded">{invite.code}</code>
                            <div className="flex gap-1">
                              {!expired && (
                                <button
                                  onClick={() => copyInviteUrl(invite.code, invite.id)}
                                  className="text-xs px-2 py-1 rounded transition-colors bg-blue-600/30 hover:bg-blue-600/50 text-blue-400"
                                >
                                  {copiedInviteId === invite.id ? '✓ Copied!' : '📋 Copy URL'}
                                </button>
                              )}
                              <button
                                onClick={() => handleRevokeInvite(invite.id)}
                                className="text-xs px-2 py-1 rounded transition-colors text-red-400 hover:bg-red-400/10"
                              >
                                Revoke
                              </button>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 space-y-0.5">
                            <div>Uses: {invite.uses}{invite.maxUses ? ` / ${invite.maxUses}` : ' (unlimited)'}</div>
                            {invite.expiresAt && (
                              <div>Expires: {new Date(invite.expiresAt).toLocaleString()}</div>
                            )}
                            {invite.createdBy && <div>Created by: {invite.createdBy}</div>}
                            {expired && <div className="text-red-400 font-bold">EXPIRED</div>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p>Select a group from the list to manage its members and invites.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupManager;
