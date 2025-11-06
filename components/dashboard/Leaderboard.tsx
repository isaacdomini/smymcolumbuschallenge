
import React from 'react';
import { GameSubmission, User } from '../../types';

interface LeaderboardProps {
  data: (GameSubmission & { user: User })[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ data }) => {
  const sortedData = [...data].sort((a, b) => b.score - a.score);

  const getRankColor = (rank: number) => {
    if (rank === 0) return 'text-yellow-400 border-yellow-400';
    if (rank === 1) return 'text-gray-300 border-gray-300';
    if (rank === 2) return 'text-yellow-600 border-yellow-600';
    return 'text-gray-400 border-gray-700';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-3xl font-bold text-center mb-6 text-yellow-400">Leaderboard</h2>
      <div className="space-y-3">
        {sortedData.length > 0 ? sortedData.map((entry, index) => (
          <div key={entry.id} className={`flex items-center justify-between p-3 rounded-lg bg-gray-700/50 border-l-4 ${getRankColor(index)}`}>
            <div className="flex items-center">
              <span className={`font-bold w-8 text-lg ${getRankColor(index)}`}>{index + 1}</span>
              <span className="font-semibold text-white">{entry.user.name}</span>
            </div>
            <div className="font-bold text-lg text-yellow-400">{entry.score} pts</div>
          </div>
        )) : (
            <p className="text-center text-gray-400 py-4">No submissions yet. Be the first to play!</p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
