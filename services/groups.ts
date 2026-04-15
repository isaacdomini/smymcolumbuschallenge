
import { Group, PublicGroup, GroupInvite } from '../types';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// ==========================================
//  GROUP CRUD
// ==========================================

export const getGroups = async (): Promise<Group[]> => {
  const response = await fetch('/api/groups', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch groups');
  return response.json();
};

export const getPublicGroups = async (search?: string): Promise<PublicGroup[]> => {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const response = await fetch(`/api/groups/public${params}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Public groups API error:', response.status, errorData);
    throw new Error(errorData.error || 'Failed to fetch public groups');
  }
  return response.json();
};

export const createGroup = async (name: string, isPublic = false): Promise<Group> => {
  const response = await fetch('/api/groups', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, isPublic })
  });
  if (!response.ok) throw new Error('Failed to create group');
  return response.json();
};

export const updateGroup = async (groupId: string, updates: { name?: string; isPublic?: boolean }): Promise<void> => {
  const response = await fetch(`/api/groups/${groupId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error('Failed to update group');
};

// ==========================================
//  JOIN / LEAVE
// ==========================================

export const joinGroup = async (code: string): Promise<{ message: string; groupName: string; groupId?: string }> => {
  const response = await fetch('/api/groups/join', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ code })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join group');
  }
  return response.json();
};

export const joinPublicGroup = async (groupId: string): Promise<{ message: string; groupName: string }> => {
  const response = await fetch(`/api/groups/${groupId}/join`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join group');
  }
  return response.json();
};

export const leaveGroup = async (groupId: string): Promise<void> => {
  const response = await fetch(`/api/groups/${groupId}/leave`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to leave group');
};

// ==========================================
//  MEMBER MANAGEMENT
// ==========================================

export const getGroupMembers = async (groupId: string): Promise<any[]> => {
  const response = await fetch(`/api/groups/${groupId}/members`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch group members');
  return response.json();
};

export const addUserToGroup = async (groupId: string, userId: string): Promise<void> => {
  const response = await fetch(`/api/groups/${groupId}/members`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add user to group');
  }
};

export const removeUserFromGroup = async (groupId: string, userId: string): Promise<void> => {
  const response = await fetch(`/api/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to remove user from group');
};

export const updateMemberRole = async (groupId: string, userId: string, role: 'member' | 'admin'): Promise<void> => {
  const response = await fetch(`/api/groups/${groupId}/members/${userId}/role`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ role })
  });
  if (!response.ok) throw new Error('Failed to update member role');
};

// ==========================================
//  INVITE MANAGEMENT
// ==========================================

export const createInvite = async (groupId: string, options?: { maxUses?: number; expiresInHours?: number }): Promise<GroupInvite> => {
  const response = await fetch(`/api/groups/${groupId}/invites`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(options || {})
  });
  if (!response.ok) throw new Error('Failed to create invite');
  return response.json();
};

export const getInvites = async (groupId: string): Promise<GroupInvite[]> => {
  const response = await fetch(`/api/groups/${groupId}/invites`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch invites');
  return response.json();
};

export const revokeInvite = async (groupId: string, inviteId: string): Promise<void> => {
  const response = await fetch(`/api/groups/${groupId}/invites/${inviteId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to revoke invite');
};
