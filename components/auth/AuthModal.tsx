import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';

interface AuthModalProps {
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const { login, signup } = useAuth();
  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); // For success messages like "check email"
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
        onClose(); // Close modal on successful login
      } else {
        const response = await signup(name, email, password);
        setMessage(response.message); // Show "Please check your email"
        // Don't close modal, show the message
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} title={isLoginView ? 'Login' : 'Sign Up'}>
      <div className="flex border-b border-gray-700 mb-4">
        <button
          className={`flex-1 py-2 text-center font-semibold ${isLoginView ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400'}`}
          onClick={() => { setIsLoginView(true); setError(''); setMessage(''); }}
        >
          Login
        </button>
        <button
          className={`flex-1 py-2 text-center font-semibold ${!isLoginView ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400'}`}
          onClick={() => { setIsLoginView(false); setError(''); setMessage(''); }}
        >
          Sign Up
        </button>
      </div>

      {message ? (
        <div className="text-center p-4">
          <p className="text-green-400">{message}</p>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginView && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-yellow-400 focus:border-yellow-400"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-yellow-400 focus:border-yellow-400"
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-yellow-400 focus:border-yellow-400"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-500"
          >
            {isLoading ? 'Loading...' : (isLoginView ? 'Login' : 'Sign Up')}
          </button>
        </form>
      )}
    </Modal>
  );
};

export default AuthModal;