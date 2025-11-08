import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Countdown from '@/components/dashboard/Countdown';
import Leaderboard from '@/components/dashboard/Leaderboard';
import WordleGame from '@/components/game/WordleGame';
import ConnectionsGame from '@/components/game/ConnectionsGame';
import CrosswordGame from '@/components/game/CrosswordGame';
import ChallengeHistory from '@/components/dashboard/ChallengeHistory';
import ChallengeIntro from '@/components/dashboard/ChallengeIntro';
import { Game, GameType, Challenge, GameSubmission, User } from '@/types';
import { getChallenge, getDailyGame, getLeaderboard, getSubmissionForToday, getGamesForChallenge, getSubmissionsForUser } from '@/services/api';
import ScoringCriteria from '@/components/dashboard/ScoringCriteria';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
};

const MainContent: React.FC = () => {
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [todaysGame, setTodaysGame] = useState<Game | null>(null);
  const [todaysSubmission, setTodaysSubmission] = useState<GameSubmission | null>(null);
  
  const [allChallengeGames, setAllChallengeGames] = useState<Game[]>([]);
  const [allUserSubmissions, setAllUserSubmissions] = useState<GameSubmission[]>([]);

  const [locationPath, setLocationPath] = useState(window.location.pathname);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null); // For verification message

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setLocationPath(path);
  }, []);

  // Check for email verification query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      setGlobalMessage('Your email has been verified! You can now log in.');
      navigate('/'); // Clear query param
      
      // Hide message after a few seconds
      const timer = setTimeout(() => setGlobalMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [navigate]);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const currentChallenge = await getChallenge();
      setChallenge(currentChallenge);
      if (currentChallenge) {
        // Check if challenge has started
        const now = new Date();
        const challengeStartDate = new Date(currentChallenge.startDate);

        if (now >= challengeStartDate) {
            const game = await getDailyGame(currentChallenge.id);
            setTodaysGame(game);

            const [games, userSubmissions] = await Promise.all([
              getGamesForChallenge(currentChallenge.id),
              user ? getSubmissionsForUser(user.id, currentChallenge.id) : Promise.resolve([])
            ]);
            setAllChallengeGames(games);
            setAllUserSubmissions(userSubmissions);
            
            if (user && game) {
                const todaySub = userSubmissions.find(s => s.gameId === game.id) ?? null;
                setTodaysSubmission(todaySub);
            } else {
                setTodaysSubmission(null);
            }
        }
        // If challenge hasn't started, todaysGame remains null
        // and leaderboard won't fetch (handled in LeaderboardWrapper)
      }
    } catch (err) {
      setError('Failed to load challenge data.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    const handleLocationChange = () => {
      setLocationPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);
  
  const now = new Date();
  const challengeStarted = challenge && new Date(challenge.startDate) <= now;

  const renderContent = () => {
    if (isLoading) return <div className="text-center p-10">Loading Challenge...</div>;
    if (error) return <div className="text-center p-10 text-red-400">{error}</div>;
    if (!challenge) return <div className="text-center p-10">No active challenge found.</div>;

    // --- Router Logic ---

    if (locationPath.startsWith('/game/')) {
        const gameId = locationPath.split('/')[2];
        if (!gameId) {
            navigate('/');
            return null;
        }
        
        // Find the game in the list of *all* games (in case user is revisiting)
        const activeGame = allChallengeGames.find(g => g.id === gameId);
        
        // Also check today's game, in case it's the one being played but fetchAll hasn't completed
        const gameToPlay = activeGame || (todaysGame?.id === gameId ? todaysGame : null);
        
        const activeSubmission = allUserSubmissions.find(s => s.gameId === gameId) ?? null;

        if (!gameToPlay) {
             // This can happen if data is still loading, or bad URL
            return <div className="text-center p-10">Loading game... (or game not found)</div>;
        }

        const onComplete = () => {
          fetchInitialData(); // refetch to update submission status
          navigate('/');
        }
        
        switch (gameToPlay.type) {
            case GameType.WORDLE:
                return <WordleGame gameData={gameToPlay.data} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
            case GameType.CONNECTIONS:
                return <ConnectionsGame gameData={gameToPlay.data} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
            case GameType.CROSSWORD:
                return <CrosswordGame gameData={gameToPlay.data} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
            default:
                // This case should not be reachable if types are correct
                const _exhaustiveCheck: never = gameToPlay;
                return <p>Unknown game type.</p>;
        }
    }

    if (locationPath === '/history') {
        if (!user) { navigate('/'); return null; }
        return <ChallengeHistory 
                    challengeId={challenge.id} 
                    userId={user.id} 
                    onPlayGame={(game) => navigate(`/game/${game.id}`)} 
                    onRevisitGame={(game, submission) => navigate(`/game/${game.id}`)}
                    onBack={() => navigate('/')}
                />;
    }
    
    // --- Dashboard (Default View) ---
    return (
        <div>
            {!user && challengeStarted && <ChallengeIntro />}
            {!challengeStarted && challenge ? (
                <Countdown targetDate={challenge.startDate} />
            ) : (
                challenge && <LeaderboardWrapper challengeId={challenge.id} />
            )}
            
            {challengeStarted && (
                <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                    {user ? (
                        <>
                            <button 
                                onClick={() => todaysGame && navigate(`/game/${todaysGame.id}`)}
                                disabled={!todaysGame}
                                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-lg text-xl shadow-lg transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                {todaysGame ? (todaysSubmission ? "Revisit Today's Game" : "Play Today's Game") : "No Game Today"}
                            </button>
                            <button
                                onClick={() => navigate('/history')}
                                 className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-xl shadow-lg transition-transform transform hover:scale-105"
                            >
                                View Challenge History
                            </button>
                        </>
                    ) : (
                        <p className="text-center text-lg bg-gray-800 p-4 rounded-lg">Please log in or sign up to participate!</p>
                    )}
                </div>
            )}

            {challengeStarted && <ScoringCriteria />}
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header challengeName={challenge?.name} onLogoClick={() => navigate('/')} />
      <main className="container mx-auto p-4 md:p-6">
        {globalMessage && (
          <div className="mb-4 p-4 text-center bg-green-700 text-white rounded-lg shadow-lg">
            {globalMessage}
          </div>
        )}
        {renderContent()}
      </main>
    </div>
  );
};

const LeaderboardWrapper: React.FC<{ challengeId: string }> = ({ challengeId }) => {
    const [leaderboardData, setLeaderboardData] = useState<(GameSubmission & { user: User })[]>([]);
    useEffect(() => {
        // Only fetch leaderboard if challenge ID is present
        if(challengeId) {
            getLeaderboard(challengeId).then(setLeaderboardData).catch(err => {
                console.error("Failed to load leaderboard", err);
                setLeaderboardData([]); // Clear data on error
            });
        }
    }, [challengeId]);

    return <Leaderboard data={leaderboardData} />;
}


export default App;