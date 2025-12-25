import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const MaintenanceScreen: React.FC = () => {
  const { user, login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      alert('Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-700 animate-fade-in relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-500 animate-pulse"></div>

        <div className="mb-6">
          <svg className="w-24 h-24 text-yellow-500 mx-auto mb-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path>
          </svg>
          <h1 className="text-3xl font-bold text-white mb-2">Under Maintenance</h1>
          <p className="text-gray-400">We're currently improving the experience. Please check back later.</p>
        </div>

        {/* Login for Admins */}
        {!user && (
          <div className="mt-8 pt-6 border-t border-gray-700">
            {!showLogin ? (
              <>
                <p className="text-sm text-gray-500 mb-4">Are you an administrator?</p>
                <button
                  onClick={() => setShowLogin(true)}
                  className="text-gray-400 hover:text-white underline text-sm transition-colors"
                >
                  Admin Login
                </button>
              </>
            ) : (
              <form onSubmit={handleLogin} className="flex flex-col space-y-3 max-w-xs mx-auto">
                <input
                  type="email"
                  placeholder="Admin Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:outline-none focus:border-yellow-500"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:outline-none focus:border-yellow-500"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-yellow-500 text-black font-bold py-2 rounded hover:bg-yellow-400 disabled:opacity-50"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="text-gray-500 text-xs hover:text-gray-300"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        )}

        {user && !user.isAdmin && (
          <div className="mt-8 pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-500 mb-2">Logged in as {user.email}</p>
            <p className="text-xs text-red-400">You do not have administrative privileges.</p>
            <button onClick={() => window.location.reload()} className="text-blue-400 text-xs hover:underline mt-2">Check Again</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintenanceScreen;
