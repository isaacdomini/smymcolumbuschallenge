import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface PasskeyPromptModalProps {
  email: string;
  onDismiss: () => void;
}

const PasskeyPromptModal: React.FC<PasskeyPromptModalProps> = ({ email, onDismiss }) => {
  const { registerPasskey } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSetup = async () => {
    setError('');
    setIsLoading(true);
    try {
      await registerPasskey(email);
      setDone(true);
    } catch (err: any) {
      // User cancelled the OS prompt — don't treat as a hard error
      if (err?.name === 'NotAllowedError' || err?.message?.includes('cancel')) {
        onDismiss();
        return;
      }
      setError(err.message || 'Could not set up passkey. Try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      {/* Sheet / card */}
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#1c1f2e 0%,#12141f 100%)' }}
      >
        {done ? (
          /* Success state */
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Passkey saved!</h3>
            <p className="text-gray-400 text-sm mb-6">
              Next time, just tap <span className="text-yellow-400 font-semibold">Sign in with Passkey</span> — no password needed.
            </p>
            <button
              onClick={onDismiss}
              className="w-full py-3 rounded-xl font-bold text-gray-900 transition-all"
              style={{ background: 'linear-gradient(90deg,#f59e0b,#fbbf24)' }}
            >
              Got it
            </button>
          </div>
        ) : (
          /* Prompt state */
          <>
            {/* Gradient header */}
            <div
              className="p-6 text-center"
              style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.08))' }}
            >
              {/* Passkey icon */}
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-yellow-500/20 flex items-center justify-center">
                <svg className="w-9 h-9 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M7 11V7a5 5 0 0110 0v4M5 11h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                  <circle cx="12" cy="16" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Sign in faster next time</h3>
              <p className="text-gray-400 text-sm">
                Use Face ID, fingerprint, or Windows Hello — no password needed.
              </p>
            </div>

            <div className="p-6 space-y-3">
              {/* Feature list */}
              <ul className="space-y-2 mb-4">
                {[
                  { icon: '🔒', text: 'More secure than a password' },
                  { icon: '⚡', text: 'One tap to sign in' },
                  { icon: '📱', text: 'Works on iOS, Android & desktop' },
                ].map(({ icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="text-base leading-none">{icon}</span>
                    {text}
                  </li>
                ))}
              </ul>

              {error && (
                <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-lg text-red-400 text-xs">
                  {error}
                </div>
              )}

              <button
                onClick={handleSetup}
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-bold text-gray-900 transition-all transform active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'linear-gradient(90deg,#f59e0b,#fbbf24)' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4 text-gray-900" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Setting up…
                  </span>
                ) : 'Set Up Passkey'}
              </button>

              <button
                onClick={onDismiss}
                className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PasskeyPromptModal;
