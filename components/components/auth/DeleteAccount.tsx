import React, { useState } from 'react';
import * as api from '../../services/api'; 

interface DeleteAccountProps {
  onBack: () => void;
}

const DeleteAccount: React.FC<DeleteAccountProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Email and password are required.');
      setIsLoading(false);
      return;
    }

    try {
      // This function needs to be created in services/api.ts
      const response = await api.requestAccountDeletion(email, password);
      setMessage(response.message);
    } catch (err: any) {
      setError(err.message || 'Failed to submit deletion request.');
    } finally {
      setIsLoading(false);
    }
  };

  if (message) {
    return (
      <div className="w-full max-w-md mx-auto mt-10 p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 text-center">
        <div className="text-green-400 mb-6 bg-green-900/30 p-4 rounded-lg border border-green-800">
          {message}
        </div>
        <button
          onClick={onBack}
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto mt-10 p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-yellow-400">Request Account Deletion</h2>
        <button 
          onClick={onBack} 
          className="text-gray-400 hover:text-white text-sm"
        >
          &larr; Back
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-950/50 border border-red-900/50 rounded-lg text-red-400 text-sm animate-shake break-words">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-400">
          Please confirm your identity by entering your email and password.
          This will send a deletion request to the administrator.
        </p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300 block ml-1">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-300 block ml-1">Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
          />
        </div>

        <div className="p-4 bg-gray-900/50 border border-yellow-700/50 rounded-lg">
          <p className="text-yellow-400 font-semibold text-center">
            Note: Upon confirmation, your account and all associated data will be permanently deleted within 48 hours.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-lg transition-all transform active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg shadow-red-500/10 mt-6"
        >
          {isLoading ? 'Submitting...' : 'Request Account Deletion'}
        </button>