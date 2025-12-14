import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { BannerMessage } from '@/components/BannerMessage';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useLogger } from './hooks/useLogger';
import Header from './components/Header';
import Countdown from './components/dashboard/Countdown';
import Leaderboard from './components/dashboard/Leaderboard';
import SupportForm from './components/SupportForm';
import TicketStatus from './components/TicketStatus';
// Lazily load components
const WordleGame = lazy(() => import('./components/game/WordleGame'));
const ConnectionsGame = lazy(() => import('./components/game/ConnectionsGame'));
const CrosswordGame = lazy(() => import('./components/game/CrosswordGame'));
const MatchTheWordGame = lazy(() => import('./components/game/MatchTheWordGame'));
const VerseScrambleGame = lazy(() => import('./components/game/VerseScrambleGame'));
const WhoAmIGame = lazy(() => import('./components/game/WhoAmIGame'));
const WordSearchGame = lazy(() => import('./components/game/WordSearchGame'));
const ChallengeHistory = lazy(() => import('./components/dashboard/ChallengeHistory'));
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const DeleteAccount = lazy(() => import('./components/auth/DeleteAccount'));
const Profile = lazy(() => import('./components/Profile'));
import ChallengeIntro from './components/dashboard/ChallengeIntro';
import { Game, GameType, Challenge, GameSubmission, User } from './types';
import { getChallenge, getDailyGame, getLeaderboard, getSubmissionForToday, getGamesForChallenge, getSubmissionsForUser, getGameState, getDailyMessage, DailyMessage as DailyMessageType } from './services/api';
import ScoringCriteria from './components/dashboard/ScoringCriteria';
import AddToHomeScreen from './components/ui/AddToHomeScreen';
import DailyMessage from './components/dashboard/DailyMessage';
import MaintenanceScreen from './components/MaintenanceScreen';
import { Capacitor } from '@capacitor/core';
// Import Style enum along with StatusBar
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp, URLOpenListenerEvent } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
// --- FIXED: Import the CORRECT Badge plugin ---
import { Badge } from '@capawesome/capacitor-badge';
import { IonApp, IonContent, IonRefresher, IonRefresherContent } from '@ionic/react';
import { RefresherEventDetail } from '@ionic/core';

// A simple loading component for Suspense
const LoadingFallback: React.FC = () => (
  <div className="text-center p-10">Loading...</div>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Toaster position="top-center" />
      <IonApp>
        <MainContent />
      </IonApp>
    </AuthProvider>
  );
};

import { useDevToolsDetection } from './hooks/useDevToolsDetection';

const MainContent: React.FC = () => {
  useLogger();
  useDevToolsDetection();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [todaysGame, setTodaysGame] = useState<Game | null>(null);
  const [todaysSubmission, setTodaysSubmission] = useState<GameSubmission | null>(null);
  const [todaysProgress, setTodaysProgress] = useState<any | null>(null);
  const [dailyMessage, setDailyMessage] = useState<DailyMessageType | null>(null);

  const [allChallengeGames, setAllChallengeGames] = useState<Game[]>([]);
  const [allUserSubmissions, setAllUserSubmissions] = useState<GameSubmission[]>([]);

  const [locationPath, setLocationPath] = useState(window.location.pathname);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    // This effect runs once on app load
    const setStatusBarPadding = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          let height = 0;

          if (Capacitor.getPlatform() === 'android') {
            try {
              const info = await StatusBar.getInfo();
              const androidHeight = (info as any).statusBarHeight;

              if (androidHeight > 0) {
                height = androidHeight;
              } else {
                console.warn('Could not read statusBarHeight from plugin, using 24px default for Android.');
                height = 24; // A common default pixel height
              }
            } catch (e) {
              console.error("Failed to get status bar info, using 24px default.", e);
              height = 24; // A common default
            }
          }

          document.documentElement.style.setProperty(
            '--safe-area-inset-top-js',
            `${height} px`
          );

          // This is correct: Use Style.Light enum
          await StatusBar.setStyle({ style: Style.Light });

        } catch (e) {
          console.error("Failed to set status bar style", e);
        }
      }
    };

    const addBackButtonListener = () => {
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (window.location.pathname !== '/') {
            window.history.back();
          } else {
            CapacitorApp.exitApp();
          }
        });
      }
    };

    const addResumeListener = () => {
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.addListener('resume', async () => {
          try {
            // This is fine
            await PushNotifications.removeAllDeliveredNotifications();
            // --- FIXED: Use Badge.clear() from the correct plugin ---
            await Badge.clear();
          } catch (err) {
            console.error("Error clearing notifications or badge count on resume", err);
          }
        });
      }
    };

    const addAppUrlOpenListener = () => {
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
          try {
            const url = new URL(event.url);
            // Navigate to the path from the URL
            // We use the pathname and search params
            const path = url.pathname + url.search;
            // Only navigate if it's a valid path for our app
            if (path) {
              // We need to ensure we are running inside the React zone if this was Angular, 
              // but for React, state updates usually trigger re-renders fine.
              // However, since this is an event listener, we might want to ensure it runs.
              navigate(path);
            }
          } catch (e) {
            console.error('Error parsing deep link url:', event.url, e);
          }
        });
      }
    };

    const clearBadgeOnLoad = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          setTimeout(async () => {
            await PushNotifications.removeAllDeliveredNotifications();
            // --- FIXED: Use Badge.clear() from the correct plugin ---
            await Badge.clear();
          }, 1000);
        } catch (err) {
          console.error("Error clearing badge on load", err);
        }
      }
    }



    setStatusBarPadding();
    addBackButtonListener();
    addResumeListener();
    addAppUrlOpenListener();
    clearBadgeOnLoad();

  }, []);


  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setLocationPath(path);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      setGlobalMessage('Your email has been verified! You can now log in to the app.');
      window.history.replaceState({}, '', '/');
      const timer = setTimeout(() => setGlobalMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (locationPath.startsWith('/reset-password') || locationPath.startsWith('/admin') || locationPath.startsWith('/privacy') || locationPath.startsWith('/request-deletion') || locationPath.startsWith('/profile')) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const currentChallenge = await getChallenge();
      setChallenge(currentChallenge);
      if (currentChallenge) {
        const now = new Date();
        const challengeStartDate = new Date(currentChallenge.startDate);
        const games = await getGamesForChallenge(currentChallenge.id);
        setAllChallengeGames(games);

        let currentSubmissions: GameSubmission[] = [];
        if (user) {
          currentSubmissions = await getSubmissionsForUser(user.id, currentChallenge.id);
          setAllUserSubmissions(currentSubmissions);
        }

        if (now >= challengeStartDate) {
          const game = await getDailyGame(currentChallenge.id);
          setTodaysGame(game);

          if (user && game) {
            const todaySub = currentSubmissions.find(s => s.gameId === game.id) ?? null;
            setTodaysSubmission(todaySub);
            if (!todaySub) {
              try {
                const progress = await getGameState(user.id, game.id);
                setTodaysProgress(progress);
              } catch (e) {
                setTodaysProgress(null);
              }
            } else {
              setTodaysProgress(null);
            }
          } else {
            setTodaysSubmission(null);
            setTodaysProgress(null);
          }
        }

        // Fetch daily message
        try {
          const message = await getDailyMessage();
          setDailyMessage(message);
        } catch (e) {
          console.error("Failed to fetch daily message", e);
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Service Unavailable') || err.message.includes('503'))) {
        setIsMaintenance(true);
      } else if (window.location.pathname === '/') {
        setError('Failed to load challenge data.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user, locationPath]);

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

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await fetchInitialData();
    event.detail.complete();
  };

  const now = new Date();
  const challengeStarted = challenge && new Date(challenge.startDate) <= now;

  const renderContent = () => {
    if (isMaintenance) {
      return <MaintenanceScreen />;
    }
    if (locationPath.startsWith('/reset-password')) {
      return <ResetPassword />;
    }
    if (locationPath.startsWith('/privacy')) {
      return <PrivacyPolicy onBack={() => navigate('/')} onNavigateToDeleteAccount={() => navigate('/request-deletion')} />;
    }
    if (locationPath.startsWith('/request-deletion')) {
      return <DeleteAccount onBack={() => navigate('/')} />;
    }
    if (locationPath.startsWith('/profile')) {
      return <Profile onBack={() => navigate('/')} />;
    }
    if (locationPath.startsWith('/admin')) {
      if (!user || !user.isAdmin) {
        navigate('/');
        return null;
      }
      return <AdminDashboard />;
    }
    if (locationPath === '/support') {
      return <SupportForm />;
    }
    if (locationPath.startsWith('/support/ticket/')) {
      const ticketId = locationPath.split('/')[3];
      if (!ticketId) { navigate('/support'); return null; }
      return <TicketStatus ticketId={ticketId} />;
    }
    if (isLoading) return <div className="text-center p-10">Loading Challenge...</div>;
    if (error) return <div className="text-center p-10 text-red-400">{error}</div>;
    if (!challenge) return <div className="text-center p-10">No active challenge found.</div>;
    if (locationPath.startsWith('/game/')) {
      if (!user) { navigate('/'); return null; }
      const gameId = locationPath.split('/')[2];
      if (!gameId) { navigate('/'); return null; }

      const isSample = gameId.startsWith('sample-');
      let gameToPlay: Game | null = null;
      let activeSubmission: GameSubmission | null = null;

      if (isSample) {
        // Construct a dummy game object for sample mode
        const typeStr = gameId.replace('sample-', '');
        let type: GameType | null = null;
        if (Object.values(GameType).includes(typeStr as GameType)) {
          type = typeStr as GameType;
        }

        if (type) {
          gameToPlay = {
            id: gameId,
            challengeId: 'sample',
            date: new Date().toISOString(),
            type: type,
            data: {} as any // Data is handled inside the component for sample mode
          } as Game;
        }
      } else {
        const activeGame = allChallengeGames.find(g => g.id === gameId);
        gameToPlay = activeGame || (todaysGame?.id === gameId ? todaysGame : null);
        activeSubmission = allUserSubmissions.find(s => s.gameId === gameId) ?? null;
      }

      if (!gameToPlay) return <div className="text-center p-10">Loading game... (or game not found)</div>;

      // Check for Revisit Block
      if (gameToPlay.revisitBlocked) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-fade-in">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-gray-700">
              <div className="text-5xl mb-6">🔒</div>
              <h2 className="text-2xl font-bold text-white mb-4">Access Restricted</h2>
              <p className="text-gray-300 text-lg mb-8">
                {gameToPlay.message || "You have already completed this game. Come back tomorrow!"}
              </p>
              <button
                onClick={() => navigate('/')}
                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-lg transition-transform transform hover:scale-105"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        );
      }

      const onComplete = () => {
        fetchInitialData();
        navigate('/');
      }
      switch (gameToPlay.type) {
        case GameType.WORDLE:
        case GameType.WORDLE_ADVANCED:
          return <WordleGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        case GameType.CONNECTIONS:
          return <ConnectionsGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        case GameType.CROSSWORD:
          return <CrosswordGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        case GameType.MATCH_THE_WORD:
          return <MatchTheWordGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        case GameType.VERSE_SCRAMBLE:
          return <VerseScrambleGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        case GameType.WHO_AM_I:
          return <WhoAmIGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        case GameType.WORD_SEARCH:
          return <WordSearchGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        default: return <p>Unknown game type.</p>;
      }
    }
    if (locationPath === '/history') {
      if (!user) { navigate('/'); return null; }
      return <ChallengeHistory challengeId={challenge.id} userId={user.id} onPlayGame={(game) => navigate(`/game/${game.id}`)} onRevisitGame={(game, submission) => navigate(`/game/${game.id}`)} onBack={() => navigate('/')} />;
    }
    return (
      <div>
        {!user && challengeStarted && <ChallengeIntro />}
        {!challengeStarted && challenge ? (
          <>
            <ChallengeIntro />
            <Countdown targetDate={challenge.startDate} />
          </>
        ) : null}
        {challengeStarted && (
          <div className="mb-8 flex flex-col sm:flex-row justify-center items-center gap-4">
            {user ? (
              <>
                <button
                  onClick={() => todaysGame && navigate(`/game/${todaysGame.id}`)}
                  disabled={!todaysGame}
                  className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-lg text-xl shadow-lg transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {todaysGame
                    ? (todaysSubmission
                      ? "Revisit Today's Game"
                      : (todaysProgress && todaysProgress.gameState && todaysProgress.gameState.startTime ? "Continue Today's Game" : "Play Today's Game"))
                    : "No Game Today"}
                </button>
                <button onClick={() => navigate('/history')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-xl shadow-lg transition-transform transform hover:scale-105">
                  View Challenge Roadmap
                </button>
              </>
            ) : (
              <p className="text-center text-lg bg-gray-800 p-4 rounded-lg">Please log in or sign up to participate!</p>
            )}
          </div>
        )}
        <BannerMessage />
        {challengeStarted && challenge ? (
          <>
            <DailyMessage message={dailyMessage} isBlurred={!todaysSubmission && !!todaysGame} />
            <LeaderboardWrapper challengeId={challenge.id} />
          </>
        ) : null}
        {user?.isAdmin && (
          <div className="mt-8 text-center">
            <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-yellow-400 underline">
              Go to Admin Dashboard
            </button>
          </div>
        )}
        {user && <ScoringCriteria />}
      </div>
    );
  }

  return (
    <IonApp>
      {locationPath.startsWith('/game/') ? (
        <header className="bg-gray-800 shadow-md relative z-20 pt-safe-top">
          <div className="container mx-auto px-4 py-3 flex items-center">
            <button onClick={() => navigate('/')} className="flex items-center text-gray-300 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <span className="ml-1 font-medium">Back</span>
            </button>
            <div id="game-header-target" className="flex-1 flex justify-end items-center"></div>
          </div>
        </header>
      ) : (
        <Header challengeName={challenge?.name} onLogoClick={() => navigate('/')} navigate={navigate} />
      )}

      <IonContent className="text-gray-100 font-sans">

        {!locationPath.startsWith('/game/') && (
          <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
            <IonRefresherContent></IonRefresherContent>
          </IonRefresher>
        )}

        <main className="container mx-auto p-4 md:p-6 pt-safe-top pb-safe-bottom">
          {globalMessage && (
            <div className="mb-4 p-4 text-center bg-green-700 text-white rounded-lg shadow-lg animate-fade-in">
              {globalMessage}
            </div>
          )}

          <Suspense fallback={<LoadingFallback />}>
            {renderContent()}
          </Suspense>
        </main>

        <AddToHomeScreen />
      </IonContent>
    </IonApp>
  );
};

const LeaderboardWrapper: React.FC<{ challengeId: string }> = ({ challengeId }) => {
  const [leaderboardData, setLeaderboardData] = useState<(GameSubmission & { user: User })[]>([]);
  useEffect(() => {
    if (challengeId) {
      getLeaderboard(challengeId).then(setLeaderboardData).catch(err => {
        console.error("Failed to load leaderboard", err);
        setLeaderboardData([]);
      });
    }
  }, [challengeId]);

  return <Leaderboard data={leaderboardData} />;
}

export default App;