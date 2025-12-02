import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '@/types';
import * as api from '@/services/api';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, emailNotifications: boolean) => Promise<{ message: string }>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (token: string, pass: string) => Promise<{ message: string }>;
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
    // The API returns the raw DB row, which has snake_case 'is_admin'
    const rawUser: any = await api.login(email, pass);
    console.log("RAW USER FROM API:", rawUser); // DEBUG LOG

    // Map to our frontend User type (camelCase)
    const userToSave: User = {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      // IMPORTANT: Map is_admin from DB to isAdmin for frontend
      isAdmin: rawUser.is_admin === true
    };
    console.log("MAPPED USER TO SAVE:", userToSave); // DEBUG LOG

    setUser(userToSave);
    localStorage.setItem('smym-user', JSON.stringify(userToSave));
  };

  const signup = async (name: string, email: string, pass: string, emailNotifications: boolean): Promise<{ message: string }> => {
    const response = await api.signup(name, email, pass, emailNotifications);
    return response;
  };

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
    localStorage.removeItem('smym-user');
  }, []);

  const forgotPassword = async (email: string) => {
    return await api.forgotPassword(email);
  }

  const resetPassword = async (token: string, pass: string) => {
    return await api.resetPassword(token, pass);
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, forgotPassword, resetPassword, isLoading }}>
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