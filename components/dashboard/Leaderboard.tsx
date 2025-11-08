import React from 'react';
import { GameSubmission, User } from '../../types';
import Tooltip from '../ui/Tooltip';
import { ICONS } from '../../constants';

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
    // Added w-full and overflow-hidden to prevent breaking container bounds.
    // Reduced padding on small screens: p-4 sm:p-6
    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-lg w-full overflow-hidden">
      <div className="flex items-center justify-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-yellow-400">Leaderboard</h2>
        <div className="ml-2 text-gray-400">
            <Tooltip text="This is the total score for all completed games in the challenge.">
              {ICONS.info}
            </Tooltip>
        </div>
      </div>
      <div className="space-y-3">
        {sortedData.length > 0 ? sortedData.map((entry, index) => (
          <div key={entry.id} className={`flex items-center justify-between p-3 rounded-lg bg-gray-700/50 border-l-4 ${getRankColor(index)}`}>
            {/* Added min-w-0 and flex-1 to allow truncation to work within flexbox */}
            <div className="flex items-center min-w-0 flex-1 mr-2">
              <span className={`font-bold w-8 text-lg ${getRankColor(index)} flex-shrink-0`}>{index + 1}</span>
              {/* Added truncate to prevent long names from overflowing */}
              <span className="font-semibold text-white truncate">{entry.user.name}</span>
            </div>
            {/* Added flex-shrink-0 and whitespace-nowrap to keep score on one line */}
            <div className="font-bold text-lg text-yellow-400 flex-shrink-0 whitespace-nowrap">{entry.score} pts</div>
          </div>
        )) : (
            <p className="text-center text-gray-400 py-4">No submissions yet. Be the first to play!</p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;