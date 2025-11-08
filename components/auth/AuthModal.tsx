import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useAuth } from '../../hooks/useAuth';

interface AuthModalProps {
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const { login, signup } = useAuth();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      if (isLoginView) {
        await login(email, password);
        onClose();
      } else {
        const response = await signup(name, email, password);
        setMessage(response.message);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchView = (view: 'login' | 'signup') => {
      setIsLoginView(view === 'login');
      setError('');
      setMessage('');
  };

  return (
    <Modal onClose={onClose} title={isLoginView ? 'Login' : 'Create Account'}>
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
        <form onSubmit={handleSubmit} className="space-y-6 w-full">
          {/* Toggle Switch */}
          <div className="flex p-1 bg-gray-900/50 rounded-lg">
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm sm:text-base font-semibold rounded-md transition-all ${isLoginView ? 'bg-gray-700 text-yellow-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              onClick={() => switchView('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 text-sm sm:text-base font-semibold rounded-md transition-all ${!isLoginView ? 'bg-gray-700 text-yellow-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              onClick={() => switchView('signup')}
            >
              Sign Up
            </button>
          </div>

          <div className="space-y-4">
              {!isLoginView && (
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300 block ml-1">Name</label>
                    <input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
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
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300 block ml-1">Password</label>
                <input
                    type="password"
                    placeholder={isLoginView ? "Enter password" : "Min 6 characters"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isLoginView ? undefined : 6}
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
                />
              </div>
          </div>

          {error && (
            <div className="p-4 bg-red-950/50 border border-red-900/50 rounded-lg text-red-400 text-sm animate-shake break-words">
                {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-3.5 px-4 rounded-lg transition-all transform active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/10 mt-2"
          >
            {isLoading ? (
                <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isLoginView ? 'Logging in...' : 'Creating Account...'}
                </span>
            ) : (isLoginView ? 'Login' : 'Create Account')}
          </button>
        </form>
      )}
    </Modal>
  );
};

export default AuthModal;