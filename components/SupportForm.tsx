import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { createTicket } from '../services/api';

const SupportForm: React.FC = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [issue, setIssue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      await createTicket(user ? user.email : email, issue, user?.id);
      setSuccess(true);
      setIssue('');
      if (!user) setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-6">Contact Support</h2>

      {success ? (
        <div className="bg-green-900/50 border border-green-500/50 p-6 rounded-lg text-center">
          <h3 className="text-xl font-bold text-green-400 mb-2">Ticket Submitted!</h3>
          <p className="text-gray-300">
            We have received your request. A confirmation email has been sent to you with a link to track your ticket status.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Submit Another Ticket
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {!user && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Your Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                placeholder="Enter your email"
              />
            </div>
          )}

          <div>
            <label htmlFor="issue" className="block text-sm font-medium text-gray-300 mb-2">
              Describe your issue
            </label>
            <textarea
              id="issue"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              required
              rows={6}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
              placeholder="Please provide as much detail as possible..."
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>
      )}
    </div>
  );
};

export default SupportForm;
