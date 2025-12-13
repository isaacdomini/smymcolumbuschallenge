import React, { useState, useEffect, useMemo } from 'react';
import { getGamesForChallenge, getSubmissionsForUser } from '../../services/api';
import { Game, GameSubmission, GameType } from '../../types';
import { getGameName } from '../../utils/game';
import Tooltip from '../ui/Tooltip';

interface ChallengeHistoryProps {
  challengeId: string;
  userId: string;
  onPlayGame: (game: Game) => void;
  onRevisitGame: (game: Game, submission: GameSubmission) => void;
  onBack: () => void;
}

const getScoringTooltipText = (gameType: GameType): string => {
  switch (gameType) {
    case GameType.WORDLE:
    case GameType.WORDLE_BANK:
      return "Score based on guesses and speed. Fewer guesses earn more points. 0 for a loss.";
    case GameType.CONNECTIONS:
      return "Score based on categories found and mistakes made. Each category adds points, mistakes subtract.";
    case GameType.CROSSWORD:
      return "Score based on accuracy and speed. A higher percentage of correct cells and a faster time result in a higher score.";
    default:
      return "Scoring is based on performance in the game.";
  }
}



const ChallengeHistory: React.FC<ChallengeHistoryProps> = ({ challengeId, userId, onPlayGame, onRevisitGame, onBack }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [submissions, setSubmissions] = useState<GameSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [gamesData, submissionsData] = await Promise.all([
          getGamesForChallenge(challengeId),
          getSubmissionsForUser(userId, challengeId)
        ]);
        setGames(gamesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())); // Sort descending
        setSubmissions(submissionsData);
      } catch (error) {
        console.error("Failed to fetch history", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [challengeId, userId]);

  const submissionsMap = useMemo(() => {
    return new Map(submissions.map(s => [s.gameId, s]));
  }, [submissions]);

  // Get today's date in 'America/New_York' timezone
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const today = new Date(todayStr + 'T12:00:00Z'); // Standardize to noon to avoid timezone/DST shifts

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-yellow-400">Challenge History</h2>
        <button onClick={onBack} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">
          &larr; Back
        </button>
      </div>

      {isLoading ? (
        <p>Loading history...</p>
      ) : (
        <div className="space-y-3">
          {games.map((game) => {
            const submission = submissionsMap.get(game.id);

            // Get the UTC date string from the ISO string (e.g., "2025-11-15" from "2025-11-15T00:00:00.000Z")
            // This assumes the DB stores the "intended day" as midnight UTC.
            const gameDateStr = game.date.split('T')[0];
            const gameDate = new Date(gameDateStr + 'T12:00:00Z'); // Standardize to noon UTC

            const isToday = gameDateStr === todayStr;
            const isFuture = gameDate > today;

            // --- Calculate lateness ---
            const diffTime = today.getTime() - gameDate.getTime();
            // diffDays will be 0 if it's today, 1 if it's yesterday, etc.
            const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            // Games are too late to play if they are more than 5 days old (e.g., 6+ days)
            const isTooLate = diffDays > 5;
            // --- End Lateness Calc ---

            return (
              <div key={game.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                <div>
                  {/* Display date in a friendly format, explicitly using EST/EDT */}
                  <p className="text-gray-400 text-sm">
                    {new Date(game.date).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xl font-bold">
                    {getGameName(game.type)}
                    {isToday && <span className="text-xs text-yellow-400 ml-2">TODAY</span>}
                    {isFuture && <span className="text-xs text-gray-500 ml-2">UPCOMING</span>}
                  </p>
                  {submission && submission.startedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Started at: {new Date(submission.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div>
                  {submission ? (
                    <Tooltip text={getScoringTooltipText(game.type)}>
                      <div className="text-right">
                        <p className="font-semibold text-lg cursor-help">{submission.score} pts</p>
                        <button onClick={() => onRevisitGame(game, submission)} className="text-blue-400 hover:text-blue-300">Revisit</button>
                      </div>
                    </Tooltip>
                  ) : isFuture ? (
                    <span className="text-gray-500 font-semibold py-2 px-4">Upcoming</span>
                  ) : isTooLate ? ( // Check if it's too late
                    <span className="text-gray-500 font-semibold py-2 px-4">Missed</span>
                  ) : (
                    <button onClick={() => onPlayGame(game)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">Play</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChallengeHistory;