import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useLogger } from './hooks/useLogger';
import Header from './components/Header';
import Countdown from './components/dashboard/Countdown';
import Leaderboard from './components/dashboard/Leaderboard';
// Lazily load components
const WordleGame = lazy(() => import('./components/game/WordleGame'));
const ConnectionsGame = lazy(() => import('./components/game/ConnectionsGame'));
const CrosswordGame = lazy(() => import('./components/game/CrosswordGame'));
const MatchTheWordGame = lazy(() => import('./components/game/MatchTheWordGame'));
const ChallengeHistory = lazy(() => import('./components/dashboard/ChallengeHistory'));
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const DeleteAccount = lazy(() => import('./components/auth/DeleteAccount'));
const Profile = lazy(() => import('./components/Profile'));
import ChallengeIntro from './components/dashboard/ChallengeIntro';
import { Game, GameType, Challenge, GameSubmission, User } from './types';
import { getChallenge, getDailyGame, getLeaderboard, getSubmissionForToday, getGamesForChallenge, getSubmissionsForUser, getGameState } from './services/api';
import ScoringCriteria from './components/dashboard/ScoringCriteria';
import AddToHomeScreen from './components/ui/AddToHomeScreen';
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
      <MainContent />
    </AuthProvider>
  );
};

const MainContent: React.FC = () => {
  useLogger();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [todaysGame, setTodaysGame] = useState<Game | null>(null);
  const [todaysSubmission, setTodaysSubmission] = useState<GameSubmission | null>(null);
  const [todaysProgress, setTodaysProgress] = useState<any | null>(null);

  const [allChallengeGames, setAllChallengeGames] = useState<Game[]>([]);
  const [allUserSubmissions, setAllUserSubmissions] = useState<GameSubmission[]>([]);

  const [locationPath, setLocationPath] = useState(window.location.pathname);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

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
            `${height}px`
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

    // New Logic: Check if live site is available and redirect
    // This serves as the "Live with Local Fallback" strategy
    const checkAndRedirectToLive = async () => {
      if (Capacitor.isNativePlatform()) {
        const liveDomain = 'youth.columbuschurch.org';
        // Check if we are already on the live domain to avoid loops
        if (window.location.hostname === liveDomain) return;

        try {
          // We fetch a small file (manifest) to check connectivity and server status
          // If this returns 200 OK, the server is up and reachable
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

          const response = await fetch(`https://${liveDomain}/manifest.webmanifest`, {
            method: 'HEAD',
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            // Server is up! Redirect to live site
            // We use window.location.href to navigate the WebView
            window.location.href = `https://${liveDomain}`;
          } else {
            console.log('Live site returned non-OK status, staying local.');
          }
        } catch (e) {
          console.log('Live site unreachable (offline or down), staying local.', e);
        }
      }
    };

    setStatusBarPadding();
    addBackButtonListener();
    addResumeListener();
    addAppUrlOpenListener();
    clearBadgeOnLoad();
    checkAndRedirectToLive();
  }, []);


  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setLocationPath(path);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      setGlobalMessage('Your email has been verified! You can now log in.');
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

        if (user) {
          const userSubmissions = await getSubmissionsForUser(user.id, currentChallenge.id);
          setAllUserSubmissions(userSubmissions);
        }

        if (now >= challengeStartDate) {
          const game = await getDailyGame(currentChallenge.id);
          setTodaysGame(game);

          if (user && game) {
            const submissions = allUserSubmissions.length > 0 ? allUserSubmissions : (user ? await getSubmissionsForUser(user.id, currentChallenge.id) : []);
            const todaySub = submissions.find(s => s.gameId === game.id) ?? null;
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
      }
    } catch (err) {
      if (window.location.pathname === '/') {
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
    if (isLoading) return <div className="text-center p-10">Loading Challenge...</div>;
    if (error) return <div className="text-center p-10 text-red-400">{error}</div>;
    if (!challenge) return <div className="text-center p-10">No active challenge found.</div>;
    if (locationPath.startsWith('/game/')) {
      if (!user) { navigate('/'); return null; }
      const gameId = locationPath.split('/')[2];
      if (!gameId) { navigate('/'); return null; }
      const activeGame = allChallengeGames.find(g => g.id === gameId);
      const gameToPlay = activeGame || (todaysGame?.id === gameId ? todaysGame : null);
      const activeSubmission = allUserSubmissions.find(s => s.gameId === gameId) ?? null;
      if (!gameToPlay) return <div className="text-center p-10">Loading game... (or game not found)</div>;
      const onComplete = () => {
        fetchInitialData();
        navigate('/');
      }
      switch (gameToPlay.type) {
        case GameType.WORDLE:
          return <WordleGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        case GameType.CONNECTIONS:
          return <ConnectionsGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        case GameType.CROSSWORD:
          return <CrosswordGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        case GameType.MATCH_THE_WORD:
          return <MatchTheWordGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
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
                      : (todaysProgress ? "Continue Today's Game" : "Play Today's Game"))
                    : "No Game Today"}
                </button>
                <button onClick={() => navigate('/history')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-xl shadow-lg transition-transform transform hover:scale-105">
                  View Challenge History
                </button>
              </>
            ) : (
              <p className="text-center text-lg bg-gray-800 p-4 rounded-lg">Please log in or sign up to participate!</p>
            )}
          </div>
        )}
        {challengeStarted && challenge ? (
          <LeaderboardWrapper challengeId={challenge.id} />
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
      <Header challengeName={challenge?.name} onLogoClick={() => navigate('/')} navigate={navigate} />
      <IonContent className="text-gray-100 font-sans">

        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

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