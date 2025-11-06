
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '../types';
import * as api from '../services/api';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('smym-user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('smym-user');
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, pass: string) => {
    const loggedInUser = await api.login(email, pass);
    setUser(loggedInUser);
    localStorage.setItem('smym-user', JSON.stringify(loggedInUser));
  };

  const signup = async (name: string, email: string, pass: string) => {
    const newUser = await api.signup(name, email, pass);
    setUser(newUser);
    localStorage.setItem('smym-user', JSON.stringify(newUser));
  };

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
    localStorage.removeItem('smym-user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
