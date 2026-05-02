import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from '@/types';
import * as api from '@/services/api';
import { storage } from '@/utils/storage';
import { jwtDecode } from "jwt-decode";
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, emailNotifications: boolean) => Promise<{ message: string }>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (token: string, pass: string) => Promise<{ message: string }>;
  isLoading: boolean;
  updateUser: (data: Partial<User>) => Promise<void>;
  /** Sign in using a registered passkey (biometric/platform authenticator) */
  loginWithPasskey: () => Promise<void>;
  /** Register a new passkey for the user identified by email */
  registerPasskey: (email: string) => Promise<void>;
  /** Whether WebAuthn / passkeys are supported on this device */
  passkeySupported: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Check if WebAuthn is available */
function checkPasskeySupport(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined'
    );
  } catch {
    return false;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passkeySupported] = useState<boolean>(checkPasskeySupport);

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

  useEffect(() => {
    const handleForceLogout = () => {
      console.log("Forced logout event received, clearing session.");
      // Manually clear storage here just in case the state updates don't propagate in time
      storage.remove('user');
      storage.remove('token');
      setUser(null);
    };

    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  /** Helper: persist a raw API user response into state + storage */
  const persistUser = useCallback(async (rawUser: any) => {
    let isAdmin = false;
    if (rawUser.token) {
      try {
        const decoded: any = jwtDecode(rawUser.token);
        isAdmin = decoded.isAdmin === true;
      } catch (e) {
        console.error("Failed to decode token", e);
      }
    }

    const userToSave: User = {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      isAdmin,
      token: rawUser.token,
    };

    setUser(userToSave);
    await storage.set('user', JSON.stringify(userToSave));
    if (rawUser.token) {
      await storage.set('token', rawUser.token);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    const rawUser: any = await api.login(email, pass);
    console.log("RAW USER FROM API:", rawUser);
    await persistUser(rawUser);
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

  /**
   * Sign in with a passkey.
   * Opens the native OS passkey picker (Face ID, Touch ID, Windows Hello, etc.)
   * No email required — uses discoverable / resident key flow.
   */
  const loginWithPasskey = useCallback(async () => {
    // Step 1: get challenge from server
    const options = await api.passkeyAuthChallenge();

    // Step 2: browser/OS shows biometric prompt
    const authResponse = await startAuthentication({ optionsJSON: options });

    // Step 3: verify with server, get JWT back
    const rawUser = await api.passkeyAuthVerify(authResponse);

    await persistUser(rawUser);
  }, [persistUser]);

  /**
   * Register a passkey for the given email.
   * Called after password-based login to layer a passkey on top.
   */
  const registerPasskey = useCallback(async (email: string) => {
    // Step 1: get registration options from server
    const options = await api.passkeyRegisterChallenge(email);

    // Step 2: browser/OS shows biometric enrolment prompt
    const registrationResponse = await startRegistration({ optionsJSON: options });

    // Step 3: verify with server (also returns a fresh token, but we don't need to re-login)
    await api.passkeyRegisterVerify(email, registrationResponse);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, login, signup, logout, forgotPassword, resetPassword,
      isLoading, updateUser, loginWithPasskey, registerPasskey, passkeySupported,
    }}>
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