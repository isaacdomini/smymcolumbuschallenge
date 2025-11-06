import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Header from './components/Header';
import Countdown from './components/dashboard/Countdown';
import Leaderboard from './components/dashboard/Leaderboard';
import WordleGame from './components/game/WordleGame';
import ConnectionsGame from './components/game/ConnectionsGame';
import CrosswordGame from './components/game/CrosswordGame';
import ChallengeHistory from './components/dashboard/ChallengeHistory';
import ChallengeIntro from './components/dashboard/ChallengeIntro';
import { Game, GameType, Challenge, GameSubmission } from './types';
import { getChallenge, getDailyGame, getLeaderboard, getSubmissionForToday } from './services/api';
import ScoringCriteria from './components/dashboard/ScoringCriteria';

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
  
  const [view, setView] = useState<'dashboard' | 'game' | 'history'>('dashboard');
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<GameSubmission | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const currentChallenge = await getChallenge();
      setChallenge(currentChallenge);
      if (currentChallenge) {
        const game = await getDailyGame(currentChallenge.id);
        setTodaysGame(game);
        if (user && game) {
            const userSubmission = await getSubmissionForToday(user.id, game.id);
            setTodaysSubmission(userSubmission);
        } else {
            setTodaysSubmission(null);
        }
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

  const handleGameComplete = () => {
    setView('dashboard');
    setActiveGame(null);
    setActiveSubmission(null);
    fetchInitialData(); // Refetch data to update submission status
  };

  const handlePlayGame = (game: Game) => {
    setActiveGame(game);
    setActiveSubmission(null);
    setView('game');
  };

  const handleRevisitGame = (game: Game, submission: GameSubmission) => {
    setActiveGame(game);
    setActiveSubmission(submission);
    setView('game');
  };


  const renderGame = () => {
    if (!activeGame) return <p>No game selected.</p>;
    
    switch (activeGame.type) {
      case GameType.WORDLE:
        return <WordleGame gameData={activeGame.data} onComplete={handleGameComplete} submission={activeSubmission} gameId={activeGame.id} />;
      case GameType.CONNECTIONS:
        return <ConnectionsGame gameData={activeGame.data} onComplete={handleGameComplete} submission={activeSubmission} gameId={activeGame.id} />;
      case GameType.CROSSWORD:
        return <CrosswordGame gameData={activeGame.data} onComplete={handleGameComplete} submission={activeSubmission} gameId={activeGame.id} />;
      default:
        return <p>Unknown game type.</p>;
    }
  };
  
  const now = new Date();
  const challengeStarted = challenge && new Date(challenge.startDate) <= now;

  const renderDashboard = () => (
    <div>
        {!user && challengeStarted && <ChallengeIntro />}
        {!challengeStarted && challenge ? (
            <Countdown targetDate={challenge.startDate} />
        ) : (
            challenge && <LeaderboardWrapper challengeId={challenge.id} />
        )}
        
        {challengeStarted && todaysGame && (
            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                {user ? (
                    <>
                        <button 
                            onClick={() => todaysSubmission ? handleRevisitGame(todaysGame, todaysSubmission) : handlePlayGame(todaysGame)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-lg text-xl shadow-lg transition-transform transform hover:scale-105"
                        >
                            {todaysSubmission ? "Revisit Today's Game" : "Play Today's Game"}
                        </button>
                        <button
                            onClick={() => setView('history')}
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

  const renderContent = () => {
    if (isLoading) return <div className="text-center p-10">Loading Challenge...</div>;
    if (error) return <div className="text-center p-10 text-red-400">{error}</div>;
    if (!challenge) return <div className="text-center p-10">No active challenge found.</div>;

    switch(view) {
        case 'game':
            return renderGame();
        case 'history':
            if (!user) {
                setView('dashboard'); // Should not happen, but as a safeguard
                return null;
            }
            return <ChallengeHistory 
                        challengeId={challenge.id} 
                        userId={user.id} 
                        onPlayGame={handlePlayGame} 
                        onRevisitGame={handleRevisitGame}
                        onBack={() => setView('dashboard')}
                    />;
        case 'dashboard':
        default:
            return renderDashboard();
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header challengeName={challenge?.name} />
      <main className="container mx-auto p-4 md:p-6">
        {renderContent()}
      </main>
    </div>
  );
};

const LeaderboardWrapper: React.FC<{ challengeId: string }> = ({ challengeId }) => {
    const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
    useEffect(() => {
        getLeaderboard(challengeId).then(setLeaderboardData);
    }, [challengeId]);

    return <Leaderboard data={leaderboardData} />;
}


export default App;
