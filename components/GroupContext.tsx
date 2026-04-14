
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Group, User } from '../types';

interface GroupContextType {
  currentGroup: Group | null;
  userGroups: (Group & { role: string })[];
  setCurrentGroup: (group: Group) => void;
  refreshGroups: () => Promise<void>;
  isLoading: boolean;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const GroupProvider: React.FC<{ children: React.ReactNode, user: User | null }> = ({ children, user }) => {
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [userGroups, setUserGroups] = useState<(Group & { role: string })[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshGroups = async () => {
    if (!user) {
      setUserGroups([]);
      setCurrentGroup(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/groups/my', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const groups = await response.json();
        setUserGroups(groups);

        // Restore selected group from local storage or default to first group
        const storedGroupId = localStorage.getItem('selectedGroupId');
        const selectedGroup = groups.find((g: Group) => g.id === storedGroupId) || groups[0] || null;

        if (selectedGroup) {
          setCurrentGroup(selectedGroup);
          localStorage.setItem('selectedGroupId', selectedGroup.id);
        }
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshGroups();
  }, [user]);

  // Update local storage when current group changes
  useEffect(() => {
    if (currentGroup) {
      localStorage.setItem('selectedGroupId', currentGroup.id);
    }
  }, [currentGroup]);

  return (
    <GroupContext.Provider value={{ currentGroup, userGroups, setCurrentGroup, refreshGroups, isLoading }}>
      {children}
    </GroupContext.Provider>
  );
};

export const useGroup = () => {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
};
