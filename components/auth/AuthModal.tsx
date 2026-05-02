import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import PasskeyPromptModal from './PasskeyPromptModal';

interface AuthModalProps {
  onClose: () => void;
}

type AuthView = 'login' | 'signup' | 'forgot-password';

const PasskeyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M7 11V7a5 5 0 0110 0v4M5 11h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" />
    <circle cx="12" cy="16" r="1.5" fill="currentColor" />
  </svg>
);

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const { login, signup, forgotPassword, loginWithPasskey, passkeySupported } = useAuth();
  const { isSupported, subscribeToPush, notificationPermission } = usePushNotifications();

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  // After password login, show passkey setup prompt if they have no passkey yet
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState('');

  // ── Passkey sign-in ─────────────────────────────────────────────
  const handlePasskeyLogin = async () => {
    setError('');
    setIsPasskeyLoading(true);
    try {
      await loginWithPasskey();
      onClose();
    } catch (err: any) {
      // User cancelled the OS prompt — silent
      if (err?.name === 'NotAllowedError' || err?.message?.includes('cancel')) return;
      setError(err.message || 'Passkey sign-in failed. Try your password instead.');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  // ── Password / signup form submit ────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      if (currentView === 'login') {
        await login(email, password);

        if (pushNotifications && isSupported && notificationPermission === 'default') {
          await subscribeToPush();
        }

        // After successful password login, show passkey prompt
        if (passkeySupported) {
          setLoggedInEmail(email);
          setShowPasskeyPrompt(true);
        } else {
          onClose();
        }

      } else if (currentView === 'signup') {
        const response = await signup(name, email, password, emailNotifications);
        if (pushNotifications && isSupported && notificationPermission === 'default') {
          setMessage(response.message + ' You can enable browser notifications after you log in.');
        } else {
          setMessage(response.message);
        }
      } else if (currentView === 'forgot-password') {
        const response = await forgotPassword(email);
        setMessage(response.message);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchView = (view: AuthView) => {
    setCurrentView(view);
    setError('');
    setMessage('');
  };

  const getTitle = () => {
    switch (currentView) {
      case 'login': return 'Welcome Back';
      case 'signup': return 'Create Account';
      case 'forgot-password': return 'Reset Password';
    }
  };

  // ── Passkey post-login prompt overlay ───────────────────────────
  if (showPasskeyPrompt) {
    return (
      <PasskeyPromptModal
        email={loggedInEmail}
        onDismiss={onClose}
      />
    );
  }

  // ── Main modal ───────────────────────────────────────────────────
  return (
    <Modal onClose={onClose} title={getTitle()}>
      {message ? (
        <div className="text-center animate-fade-in w-full">
          <div className="text-green-400 mb-6 bg-green-900/30 p-4 rounded-lg border border-green-800 break-words">
            {message}
          </div>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      ) : (
        <div className="space-y-5 w-full">

          {/* ── View Toggle ─────────────────────────────────── */}
          {currentView !== 'forgot-password' && (
            <div className="flex p-1 bg-gray-900/50 rounded-lg">
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm sm:text-base font-semibold rounded-md transition-all ${currentView === 'login' ? 'bg-gray-700 text-yellow-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                onClick={() => switchView('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm sm:text-base font-semibold rounded-md transition-all ${currentView === 'signup' ? 'bg-gray-700 text-yellow-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                onClick={() => switchView('signup')}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* ── Passkey Button (Login & Signup tabs) ─────────── */}
          {currentView !== 'forgot-password' && passkeySupported && (
            <>
              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={isPasskeyLoading || isLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-bold transition-all transform active:scale-[0.98] disabled:opacity-60 border border-yellow-500/40 hover:border-yellow-500/70"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(251,191,36,0.10) 100%)',
                  color: '#fbbf24',
                }}
              >
                {isPasskeyLoading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Waiting for passkey…</span>
                  </>
                ) : (
                  <>
                    <PasskeyIcon />
                    <span>
                      {currentView === 'login' ? 'Sign in with Passkey' : 'Sign up with Passkey'}
                    </span>
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-700/60" />
                <span className="text-xs text-gray-500 shrink-0">or continue with email</span>
                <div className="flex-1 h-px bg-gray-700/60" />
              </div>
            </>
          )}

          {/* ── Email / Password Form ─────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {currentView === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300 block ml-1">Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300 block ml-1">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete={currentView === 'login' ? 'username' : 'email'}
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
              />
            </div>

            {currentView !== 'forgot-password' && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-medium text-gray-300 block">Password</label>
                  {currentView === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchView('forgot-password')}
                      className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  placeholder={currentView === 'login' ? "Enter password" : "Min 6 characters"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={currentView === 'signup' ? 6 : undefined}
                  autoComplete={currentView === 'login' ? "current-password" : "new-password"}
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
                />
              </div>
            )}

            <div className="space-y-2">
              {currentView === 'signup' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="w-4 h-4 text-yellow-500 bg-gray-900 border-gray-700 rounded focus:ring-yellow-500 focus:ring-2"
                  />
                  <label htmlFor="emailNotifications" className="text-sm text-gray-300">
                    Receive daily reminder emails
                  </label>
                </div>
              )}
              {currentView === 'login' && isSupported && notificationPermission === 'default' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="pushNotifications"
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    className="w-4 h-4 text-yellow-500 bg-gray-900 border-gray-700 rounded focus:ring-yellow-500 focus:ring-2"
                  />
                  <label htmlFor="pushNotifications" className="text-sm text-gray-300">
                    Enable browser notifications on this device
                  </label>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-950/50 border border-red-900/50 rounded-lg text-red-400 text-sm animate-shake break-words">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isPasskeyLoading}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-3.5 px-4 rounded-lg transition-all transform active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/10 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                currentView === 'login' ? 'Login' :
                  currentView === 'signup' ? 'Create Account' :
                    'Send Reset Link'
              )}
            </button>

            {currentView === 'forgot-password' && (
              <button
                type="button"
                onClick={() => switchView('login')}
                className="w-full text-gray-400 hover:text-white text-sm py-2 transition-colors"
              >
                Back to Login
              </button>
            )}
          </form>
        </div>
      )}
    </Modal>
  );
};

export default AuthModal;