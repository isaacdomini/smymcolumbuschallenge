import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getAdminSubmissions } from '../../services/api';

const SubmissionViewer: React.FC = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [filterGameType, setFilterGameType] = useState<string>('');
  const [filterGameId, setFilterGameId] = useState<string>('');
  const [filterUserId, setFilterUserId] = useState<string>('');

  const fetchSubmissions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getAdminSubmissions(user.id, limit, page * limit, {
        gameType: filterGameType || undefined,
        gameId: filterGameId || undefined,
        userId: filterUserId || undefined
      });
      setSubmissions(data.submissions);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [user, page]); // Re-fetch on page change

  // Handle filter submit
  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0); // Reset to first page
    fetchSubmissions();
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Submission History</h2>
        <button
          onClick={fetchSubmissions}
          className="text-gray-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilterSubmit} className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Game Type</label>
          <select
            value={filterGameType}
            onChange={(e) => setFilterGameType(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
          >
            <option value="">All Types</option>
            <option value="wordle">Wordle</option>
            <option value="wordle_advanced">Wordle Advanced</option>
            <option value="wordle_bank">Wordle Bank</option>
            <option value="connections">Connections</option>
            <option value="crossword">Crossword</option>
            <option value="match_the_word">Match The Word</option>
            <option value="verse_scramble">Verse Scramble</option>
            <option value="who_am_i">Who Am I</option>
            <option value="word_search">Word Search</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Game ID</label>
          <input
            type="text"
            placeholder="e.g. game-wordle-2023-..."
            value={filterGameId}
            onChange={(e) => setFilterGameId(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">User ID</label>
          <input
            type="text"
            placeholder="Filter by User ID"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="bg-yellow-600 hover:bg-yellow-500 text-white font-medium py-2 px-4 rounded w-full transition-colors text-sm"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-sm">
              <th className="py-3 px-2">Date</th>
              <th className="py-3 px-2">User</th>
              <th className="py-3 px-2">Game</th>
              <th className="py-3 px-2 text-right">Score</th>
              <th className="py-3 px-2 text-right">Time</th>
              <th className="py-3 px-2 text-right">Mistakes</th>
              <th className="py-3 px-2 text-right">Submitted</th>
            </tr>
          </thead>
          <tbody className="text-gray-300 text-sm">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8">Loading...</td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">No submissions found.</td>
              </tr>
            ) : (
              submissions.map((sub) => (
                <tr key={sub.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-3 px-2 whitespace-nowrap">
                    {new Date(sub.gameDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2">
                    <div className="text-white font-medium">{sub.userName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{sub.userEmail}</div>
                    <div className="text-[10px] text-gray-600 font-mono mt-0.5">{sub.userId}</div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-700 border border-gray-600">
                      {sub.gameType}
                    </span>
                    <div className="text-[10px] text-gray-600 font-mono mt-1 truncate max-w-[150px]" title={sub.gameId}>{sub.gameId}</div>
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-yellow-500">{sub.score}</td>
                  <td className="py-3 px-2 text-right">{sub.timeTaken}s</td>
                  <td className="py-3 px-2 text-right">{sub.mistakes}</td>
                  <td className="py-3 px-2 text-right text-gray-500 text-xs whitespace-nowrap">
                    {new Date(sub.completedAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-6 text-sm text-gray-400">
        <div>
          Showing {submissions.length > 0 ? page * limit + 1 : 0} to {Math.min((page + 1) * limit, total)} of {total}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * limit >= total}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionViewer;
