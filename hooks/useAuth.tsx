import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '@/types';
import * as api from '@/services/api';
import { storage } from '@/utils/storage';
import { jwtDecode } from "jwt-decode";

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, emailNotifications: boolean) => Promise<{ message: string }>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (token: string, pass: string) => Promise<{ message: string }>;
  isLoading: boolean;
  updateUser: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);



export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUserStr = await storage.get('user');
        const storedToken = await storage.get('token');

        if (storedUserStr) {
          const storedUser = JSON.parse(storedUserStr);

          if (storedToken) {
            // Happy path: User and token exist
            try {
              const decoded: any = jwtDecode(storedToken);
              // Securely set isAdmin from the token payload, ignoring local storage value
              const verifiedUser = { ...storedUser, token: storedToken, isAdmin: decoded.isAdmin === true };
              setUser(verifiedUser);
            } catch (e) {
              console.error("Invalid token in storage", e);
              // Token invalid, logout
              await storage.remove('user');
              await storage.remove('token');
              setUser(null);
            }
          } else {
            // Migration path: User exists but no token (legacy session)
            console.log("Migrating legacy session for user:", storedUser.id);
            try {
              // Call migration endpoint
              const rawUser: any = await api.migrateSession(storedUser.id);

              // Decode the new token
              const decoded: any = jwtDecode(rawUser.token);

              const userToSave: User = {
                id: rawUser.id,
                name: rawUser.name,
                email: rawUser.email,
                isAdmin: decoded.isAdmin === true, // Use decoded value
                token: rawUser.token
              };

              setUser(userToSave);
              await storage.set('user', JSON.stringify(userToSave));
              if (userToSave.token) {
                await storage.set('token', userToSave.token);
              }
              console.log("Session migration successful");
            } catch (migrationError) {
              console.error("Session migration failed:", migrationError);
              // If migration fails (e.g. user deleted), clear storage
              await storage.remove('user');
              await storage.remove('token');
              setUser(null);
            }
          }
        }
      } catch (error) {
        console.error("Failed to parse user from storage", error);
        await storage.remove('user');
        await storage.remove('token');
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (email: string, pass: string) => {
    // The API returns the raw DB row, which has snake_case 'is_admin'
    const rawUser: any = await api.login(email, pass);
    console.log("RAW USER FROM API:", rawUser); // DEBUG LOG

    // Map to our frontend User type (camelCase)
    let isAdmin = false;
    if (rawUser.token) {
      try {
        const decoded: any = jwtDecode(rawUser.token);
        isAdmin = decoded.isAdmin === true;
      } catch (e) {
        console.error("Failed to decode token on login", e);
      }
    }

    const userToSave: User = {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      // IMPORTANT: Map is_admin from token payload for security
      isAdmin: isAdmin,
      token: rawUser.token // Save the token
    };
    console.log("MAPPED USER TO SAVE:", userToSave); // DEBUG LOG

    setUser(userToSave);
    await storage.set('user', JSON.stringify(userToSave));
    if (rawUser.token) {
      await storage.set('token', rawUser.token);
    }
  };

  const signup = async (name: string, email: string, pass: string, emailNotifications: boolean): Promise<{ message: string }> => {
    const response = await api.signup(name, email, pass, emailNotifications);
    return response;
  };

  const logout = useCallback(async () => {
    api.logout();
    setUser(null);
    await storage.remove('user');
    await storage.remove('token');
  }, []);

  const forgotPassword = async (email: string) => {
    return await api.forgotPassword(email);
  }

  const resetPassword = async (token: string, pass: string) => {
    return await api.resetPassword(token, pass);
  }

  const updateUser = async (data: Partial<User>) => {
    if (!user) return;
    const newUser = { ...user, ...data };
    setUser(newUser);
    await storage.set('user', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, forgotPassword, resetPassword, isLoading, updateUser }}>
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