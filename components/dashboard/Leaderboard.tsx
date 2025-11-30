import React from 'react';
import { GameSubmission, User } from '@/types';
import Tooltip from '@/components/ui/Tooltip';
import { ICONS } from '@/constants';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth

interface LeaderboardProps {
  data: (GameSubmission & { user: User })[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ data }) => {
  const { user: currentUser } = useAuth(); // Get the current user
  const [showAll, setShowAll] = React.useState(false);
  const sortedData = [...data].sort((a, b) => b.score - a.score);

  const getRankColor = (rank: number) => {
    if (rank === 0) return 'text-yellow-400 border-yellow-400';
    if (rank === 1) return 'text-gray-300 border-gray-300';
    if (rank === 2) return 'text-yellow-600 border-yellow-600';
    return 'text-gray-400 border-gray-700';
  };

  // Find the current user's rank
  const currentUserRankIndex = currentUser
    ? sortedData.findIndex(entry => entry.userId === currentUser.id)
    : -1;

  // Calculate cutoff: show at least 5, but include all ties for 1st place
  const firstPlaceScore = sortedData.length > 0 ? sortedData[0].score : null;
  const firstPlaceCount = sortedData.filter(e => e.score === firstPlaceScore).length;
  const cutoffIndex = Math.max(5, firstPlaceCount);

  // Determine which data to display
  const displayedData = showAll ? sortedData : sortedData.slice(0, cutoffIndex);

  // Get the current user's entry if they exist and are not in the displayed list
  const currentUserEntry = (!showAll && currentUserRankIndex !== -1 && currentUserRankIndex >= cutoffIndex)
    ? sortedData[currentUserRankIndex]
    : null;

  // Helper function to render a single leaderboard row
  const renderRow = (entry: GameSubmission & { user: User }, index: number) => {
    const isCurrentUser = entry.userId === currentUser?.id;
    // Use standard competition ranking (1224)
    const rank = sortedData.findIndex(e => e.score === entry.score) + 1;

    return (
      <div
        key={entry.id}
        className={`flex items-center justify-between p-3 rounded-lg bg-gray-700/50 border-l-4
          ${isCurrentUser ? 'border-blue-400 bg-gray-700' : getRankColor(index)}
        `}
      >
        <div className="flex items-center min-w-0 flex-1 mr-2">
          <span className={`font-bold w-8 text-lg ${isCurrentUser ? 'text-blue-400' : getRankColor(index)} flex-shrink-0`}>
            {rank}
          </span>
          <span className={`font-semibold truncate ${isCurrentUser ? 'text-blue-300' : 'text-white'}`}>
            {entry.user.name} {isCurrentUser && '(You)'}
          </span>
        </div>
        <div className="font-bold text-lg text-yellow-400 flex-shrink-0 whitespace-nowrap">
          {entry.score} pts
        </div>
      </div>
    );
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
        {sortedData.length > 0 ? (
          <>
            {displayedData.map((entry, index) => renderRow(entry, index))}

            {currentUserEntry && (
              <>
                <div className="flex items-center justify-center py-2">
                  <div className="h-px w-1/3 bg-gray-600"></div>
                  <span className="text-gray-500 text-sm mx-2">...</span>
                  <div className="h-px w-1/3 bg-gray-600"></div>
                </div>
                {/* Pass the user's actual rank index here */}
                {renderRow(currentUserEntry, currentUserRankIndex)}
              </>
            )}

            {sortedData.length > cutoffIndex && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full py-2 mt-4 text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors flex items-center justify-center"
              >
                {showAll ? (
                  <>
                    Show Less <span className="ml-1">↑</span>
                  </>
                ) : (
                  <>
                    Show More ({sortedData.length - cutoffIndex} others) <span className="ml-1">↓</span>
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <p className="text-center text-gray-400 py-4">No submissions yet. Be the first to play!</p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;