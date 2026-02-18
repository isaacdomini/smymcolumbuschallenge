
import { Group } from '../types';

export const getGroups = async (): Promise<Group[]> => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/groups', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to fetch groups');
  return response.json();
};

export const createGroup = async (name: string): Promise<Group> => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/groups', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name })
  });
  if (!response.ok) throw new Error('Failed to create group');
  return response.json();
};

export const joinGroup = async (code: string): Promise<void> => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/groups/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ code })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join group');
  }
};

export const getGroupMembers = async (groupId: string): Promise<any[]> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/groups/${groupId}/members`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to fetch group members');
  return response.json();
};

export const addUserToGroup = async (groupId: string, email: string): Promise<void> => {
  const token = localStorage.getItem('token');
  // First, we need to find the user by email (or backend handles it)
  // Assuming backend endpoint expects userId, but UI asks for email. 
  // Let's assume the backend endpoint handles lookup or we need a lookup.
  // Actually, looking at server/src/routes/groups.ts (from memory), it probably expects userId.
  // But for admin convenience, email is better.
  // Let's assume we pass email and backend handles it or we lookup first.
  // Wait, the backend route I designed likely expects userId.
  // Let's use the USER search from api.ts if needed, but for now let's try sending email if backend supports it, 
  // or lookup user first.
  // Let's implemented a lookup helper here or just use api.getUsers with filter? 
  // api.getUsers doesn't have a search by email filter exposed easily.
  // Let's assume proper backend implementation or use what we have.
  // I will try to fetch all users and find the one with email, then add.

  // Actually, to be safe and quick, I'll use the existing getUsers from api.ts in the Component to find ID, then call this with ID.
  // So this function should take userId.
  const response = await fetch(`/api/groups/${groupId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ userId: email }) // Passing ID as 'userId'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add user to group');
  }
};

export const removeUserFromGroup = async (groupId: string, userId: string): Promise<void> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to remove user from group');
};
