import React, { useState, useEffect, useCallback, Suspense, lazy, useMemo } from 'react';
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
const PropertyMatcherGame = lazy(() => import('./components/game/PropertyMatcherGame'));
const BookGuesserGame = lazy(() => import('./components/game/BookGuesserGame'));
const ChallengeHistory = lazy(() => import('./components/dashboard/ChallengeHistory'));
const MyChallenges = lazy(() => import('./components/dashboard/MyChallenges'));
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const DeleteAccount = lazy(() => import('./components/auth/DeleteAccount'));
const Profile = lazy(() => import('./components/Profile'));
const LongTextPage = lazy(() => import('./components/LongTextPage'));
const GroupBrowser = lazy(() => import('./components/GroupBrowser'));
import ChallengeIntro from './components/dashboard/ChallengeIntro';
const ChristmasFlair = lazy(() => import('./components/ChristmasFlair'));
import { Game, GameType, Challenge, GameSubmission, User } from './types';
import { getChallenge, getDailyGames, getLeaderboard, getSubmissionForToday, getGamesForChallenge, getSubmissionsForUser, getGameState, getDailyMessage, getPublicFeatureFlags, getServerVersion, DailyMessage as DailyMessageType, sendAppDeprecationEmailRequest } from './services/api';
import { getGameName } from './utils/game';
import ScoringCriteria from './components/dashboard/ScoringCriteria';
import AddToHomeScreen from './components/ui/AddToHomeScreen';
import DailyMessage from './components/dashboard/DailyMessage';
import MaintenanceScreen from './components/MaintenanceScreen';
import { Capacitor } from '@capacitor/core';
// Import Style enum along with StatusBar
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp, URLOpenListenerEvent } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { Badge } from '@capawesome/capacitor-badge';
import { IonApp, IonContent, IonRefresher, IonRefresherContent } from '@ionic/react';
import { RefresherEventDetail } from '@ionic/core';
import { version as APP_VERSION } from './package.json';

// A simple loading component for Suspense
const LoadingFallback: React.FC = () => (
  <div className="text-center p-10">Loading...</div>
);

// Catches chunk load errors when the server deploys a new version 
// and the mobile webview tries to load an old cached chunk.
class ChunkErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    const isChunkLoadFailed = /Loading chunk [\d]+ failed/i.test(error.message) || 
                              /Failed to fetch dynamically imported module/i.test(error.message) || 
                              /Importing a module script failed/i.test(error.message);
    if (isChunkLoadFailed) {
      const lastReload = sessionStorage.getItem('chunk_reload_time');
      const now = Date.now();
      
      // If we reloaded less than 10 seconds ago, don't reload again to prevent infinite loops
      if (lastReload && now - parseInt(lastReload, 10) < 10000) {
        console.error('Chunk load error persists after reload. Stopping infinite loop.');
        return;
      }
      
      sessionStorage.setItem('chunk_reload_time', now.toString());
      console.warn('Chunk load error caught. Forcing cache-busted reload...');
      
      // Use query param to aggressively bust the webview cache instead of just reloading
      const url = new URL(window.location.href);
      url.searchParams.set('v', now.toString());
      window.location.href = url.toString();
    }
  }

  render() {
    if (this.state.hasError) {
      const lastReload = sessionStorage.getItem('chunk_reload_time');
      const now = Date.now();
      const isLooping = lastReload && now - parseInt(lastReload || '0', 10) < 10000;

      if (isLooping) {
        return (
          <div className="flex flex-col items-center justify-center p-8 mt-20 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-200 mb-2">Update Failed</h2>
            <p className="text-gray-400 text-sm mb-6">The app is having trouble updating. Please try manually restarting the app.</p>
            <button onClick={() => {
              sessionStorage.removeItem('chunk_reload_time');
              window.location.href = '/';
            }} className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-6 rounded-lg transition-colors">
              Try Again
            </button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 mt-20 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400 mb-4 mx-auto"></div>
          <h2 className="text-xl font-bold text-gray-200 mb-2">Updating App...</h2>
          <p className="text-gray-400 text-sm">Please wait while we load the latest version.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

import { GroupProvider, useGroup } from './components/GroupContext';
import { joinGroup } from './services/groups';

// Join by invite code flow
const JoinByInvite: React.FC<{ code: string; user: User | null; navigate: (path: string) => void }> = ({ code, user, navigate }) => {
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error' | 'needsLogin'>('loading');
  const [message, setMessage] = React.useState('');
  const [groupName, setGroupName] = React.useState('');
  const { refreshGroups } = useGroup();

  React.useEffect(() => {
    if (!code) {
      setStatus('error');
      setMessage('Invalid invite link');
      return;
    }

    if (!user) {
      setStatus('needsLogin');
      return;
    }

    // Auto-join
    joinGroup(code)
      .then(async (result) => {
        setStatus('success');
        setGroupName(result.groupName);
        setMessage(`You've joined "${result.groupName}"!`);
        await refreshGroups();
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Failed to join group');
      });
  }, [code, user]);

  return (
    <div className="max-w-md mx-auto mt-16 text-center">
      {status === 'loading' && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Joining group...</p>
        </div>
      )}
      {status === 'success' && (
        <div className="bg-gray-800 border border-green-600/50 rounded-xl p-8">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-white mb-2">Welcome!</h2>
          <p className="text-green-400 mb-6">{message}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      )}
      {status === 'error' && (
        <div className="bg-gray-800 border border-red-600/50 rounded-xl p-8">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-white mb-2">Couldn't Join</h2>
          <p className="text-red-400 mb-6">{message}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/groups')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
            >
              Browse Groups
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-6 rounded-lg transition-colors"
            >
              Home
            </button>
          </div>
        </div>
      )}
      {status === 'needsLogin' && (
        <div className="bg-gray-800 border border-yellow-600/50 rounded-xl p-8">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
          <p className="text-gray-300 mb-6">You need to log in or sign up before joining this group.</p>
          <p className="text-gray-400 text-xs mb-4">After logging in, revisit this link to join the group.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-lg transition-colors"
          >
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <GroupProvider>
        <Toaster position="top-center" />
        <IonApp>
          <MainContent />
        </IonApp>
      </GroupProvider>
    </AuthProvider>
  );
};

import { useDevToolsDetection } from './hooks/useDevToolsDetection';

const MainContent: React.FC = () => {
  useLogger();
  useDevToolsDetection();
  const { user } = useAuth();
  const { currentGroup } = useGroup();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [todaysGames, setTodaysGames] = useState<Game[]>([]);
  const [todaysSubmission, setTodaysSubmission] = useState<GameSubmission | null>(null);
  const [todaysProgressMap, setTodaysProgressMap] = useState<Record<string, any>>({});
  const [todaysProgress, setTodaysProgress] = useState<any | null>(null); // Kept for legacy compatibility if needed, using map mostly
  const [dailyMessage, setDailyMessage] = useState<DailyMessageType | null>(null);
  const [showChristmasFlair, setShowChristmasFlair] = useState(false);

  const [allChallengeGames, setAllChallengeGames] = useState<Game[]>([]);
  const [allUserSubmissions, setAllUserSubmissions] = useState<GameSubmission[]>([]);

  const [locationPath, setLocationPath] = useState(window.location.pathname);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isBlockedApp, setIsBlockedApp] = useState(false);
  const [deprecationEmailStatus, setDeprecationEmailStatus] = useState<{ sent: boolean, timestamp: string } | null>(null);
  const [deprecationEmailSending, setDeprecationEmailSending] = useState(false);

  useEffect(() => {
    const sendOrCheckEmail = async () => {
      if (isBlockedApp && user && !deprecationEmailSending && !deprecationEmailStatus) {
        setDeprecationEmailSending(true);
        try {
          const res = await sendAppDeprecationEmailRequest(user.id);
          setDeprecationEmailStatus({
            sent: res.status === 'sent_now',
            timestamp: res.timestamp
          });
        } catch (e) {
          console.error("Failed to check or send deprecation email", e);
        } finally {
          setDeprecationEmailSending(false);
        }
      }
    };
    sendOrCheckEmail();
  }, [isBlockedApp, user, deprecationEmailSending, deprecationEmailStatus]);

  // Memoize the set of submitted game IDs to avoid recalculation on every render
  const submittedGameIds = useMemo(() => new Set(allUserSubmissions.map(s => s.gameId)), [allUserSubmissions]);

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

    // Check version
    const checkVersion = async () => {
      if (import.meta.env.MODE === 'development') return; // Skip in dev

      const serverData = await getServerVersion();
      if (serverData && serverData.version && serverData.version !== APP_VERSION) {
        const lastReloadVersion = sessionStorage.getItem('reloaded_for_version');
        
        // If we already tried reloading for this specific version and it's STILL a mismatch,
        // it means either the webview cache is unbreakable, OR the server hasn't been re-built
        // with the new frontend code yet. Stop the infinite loop.
        if (lastReloadVersion === serverData.version) {
          console.error(`Already attempted to reload for version ${serverData.version} but app is still on ${APP_VERSION}. Stopping infinite loop.`);
          return;
        }

        console.log(`Version mismatch: Local ${APP_VERSION} vs Server ${serverData.version}. Reloading...`);
        sessionStorage.setItem('reloaded_for_version', serverData.version);
        
        // Force reload with cache busting
        const url = new URL(window.location.href);
        url.searchParams.set('v', serverData.version); // Track version
        url.searchParams.set('t', Date.now().toString()); // Bust cache
        window.location.replace(url.toString());
      } else if (serverData && serverData.version === APP_VERSION) {
        // Clear it if we successfully updated
        sessionStorage.removeItem('reloaded_for_version');
      }
    };

    // Check on load
    checkVersion();

    // Check on resume
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('resume', checkVersion);
    }

  }, []);


  const navigate = useCallback((path: string, state?: any) => {
    window.history.pushState(state || {}, '', path);
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
    if (locationPath.startsWith('/reset-password') || locationPath.startsWith('/admin') || locationPath.startsWith('/privacy') || locationPath.startsWith('/request-deletion') || locationPath.startsWith('/profile') || locationPath === '/message-viewer' || locationPath.startsWith('/groups') || locationPath.startsWith('/join/')) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Check feature flags first
      const flags = await getPublicFeatureFlags();
      if (flags.maintenance_mode && (!user || !user.isAdmin)) {
        setIsMaintenance(true);
        // Important: Stop loading other data if in maintenance
        setIsLoading(false);
        return;
      } else {
        setIsMaintenance(false);
      }

      if (flags.deprecation_banner_active) {
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
          try {
            const info = await CapacitorApp.getInfo();
            if (info.id === 'com.tesarsoft.smym.biblegames') {
              setIsBlockedApp(true);
            }
          } catch (e) {
            console.error("Failed to check app info", e);
          }
        }
      }

      if (flags.christmas_flair) {
        setShowChristmasFlair(true);
      } else {
        setShowChristmasFlair(false);
      }

      const currentChallenge = await getChallenge(currentGroup?.id);
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
          const games = await getDailyGames(currentChallenge.id);
          setTodaysGames(games);

          if (user) {
            // Fetch progress for all daily games to enable "Continue" button
            const progressPromises = games.map(g => getGameState(user.id, g.id).catch(() => null));
            const progresses = await Promise.all(progressPromises);
            const newProgressMap: Record<string, any> = {};
            games.forEach((g, i) => {
              if (progresses[i]) {
                newProgressMap[g.id] = progresses[i];
              }
            });
            setTodaysProgressMap(newProgressMap);

            setTodaysSubmission(null);
            setTodaysProgress(null);
          } else {
            setTodaysSubmission(null);
            setTodaysProgress(null);
            setTodaysProgressMap({});
          }
        }

        // Fetch daily message (group-specific)
        try {
          const message = await getDailyMessage(undefined, currentGroup?.id || 'default');
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
  }, [user, locationPath, currentGroup]);

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
  const isTestUser = user?.email?.toLowerCase().startsWith('test') || false;

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
    if (locationPath.startsWith('/message-viewer')) {
      return <LongTextPage navigate={navigate} />;
    }
    if (locationPath.startsWith('/admin')) {
      if (!user || !user.isAdmin) {
        navigate('/');
        return null;
      }
      return <AdminDashboard />;
    }
    if (locationPath === '/groups') {
      return <GroupBrowser onBack={() => navigate('/')} navigate={navigate} />;
    }
    if (locationPath.startsWith('/join/')) {
      const inviteCode = locationPath.split('/')[2];
      return <JoinByInvite code={inviteCode} user={user} navigate={navigate} />;
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
        const activeGame = todaysGames.find(g => g.id === gameId);
        gameToPlay = activeGame || (allChallengeGames.find(g => g.id === gameId) ?? null);
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
        case GameType.PROPERTY_MATCHER:
          return <PropertyMatcherGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        case GameType.BOOK_GUESSER:
          return <BookGuesserGame gameData={gameToPlay.data as any} onComplete={onComplete} submission={activeSubmission} gameId={gameToPlay.id} />;
        default: return <p>Unknown game type.</p>;
      }
    }
    if (locationPath === '/history') {
      if (!user) { navigate('/'); return null; }
      return <MyChallenges onSelectChallenge={(id) => navigate(`/history/${id}`)} onBack={() => navigate('/')} />;
    }
    if (locationPath.startsWith('/history/')) {
      if (!user) { navigate('/'); return null; }
      const historyChallengeId = locationPath.split('/')[2];
      if (!historyChallengeId) { navigate('/history'); return null; }
      return <ChallengeHistory challengeId={historyChallengeId} userId={user.id} onPlayGame={(game) => {
        if (user.email.startsWith('test')) {
          navigate(`/game/sample-${game.type}`);
        } else {
          navigate(`/game/${game.id}`);
        }
      }} onRevisitGame={(game, submission) => {
        if (user.email.startsWith('test')) {
          navigate(`/game/sample-${game.type}`);
        } else {
          navigate(`/game/${game.id}`);
        }
      }} onBack={() => navigate('/history')} isTestUser={isTestUser} />;
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
              <div className="flex flex-col gap-4 items-center w-full max-w-md">
                {todaysGames.length > 0 ? (
                  todaysGames.map(game => {
                    const isSubmitted = submittedGameIds.has(game.id);
                    const progress = todaysProgressMap[game.id];
                    const isInProgress = !isSubmitted && progress && progress.gameState && progress.gameState.startTime;

                    let label = `Play ${getGameName(game.type, isTestUser)}`;
                    if (isSubmitted) {
                      label = `Revisit ${getGameName(game.type, isTestUser)}`;
                    } else if (isInProgress) {
                      label = `Continue ${getGameName(game.type, isTestUser)}`;
                    }

                    return (
                      <button
                        key={game.id}
                        onClick={() => {
                          if (user.email.startsWith('test')) {
                            navigate(`/game/sample-${game.type}`);
                          } else {
                            navigate(`/game/${game.id}`);
                          }
                        }}
                        className={`w-full font-bold py-3 px-8 rounded-lg text-xl shadow-lg transition-transform transform hover:scale-105 ${isSubmitted ? 'bg-green-600 hover:bg-green-700 text-white' : (isInProgress ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-gray-900')}`}
                      >
                        {label}
                      </button>
                    );
                  })
                ) : (
                  <button
                    disabled
                    className="bg-gray-700 text-gray-500 font-bold py-3 px-8 rounded-lg text-xl shadow-lg cursor-not-allowed"
                  >
                    No Games Today
                  </button>
                )}

                <button onClick={() => navigate('/history')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-xl shadow-lg transition-transform transform hover:scale-105">
                  View Challenge Roadmap
                </button>
              </div>
            ) : (
              <p className="text-center text-lg bg-gray-800 p-4 rounded-lg">Please log in or sign up to participate!</p>
            )}
          </div>
        )}
        <BannerMessage />
        {challengeStarted && challenge ? (
          <>
            <DailyMessage
              message={dailyMessage}
              isBlurred={
                !isTestUser &&
                todaysGames.length > 0 &&
                !todaysGames.some(g => submittedGameIds.has(g.id))
              }
              navigate={navigate}
            />
            <LeaderboardWrapper challengeId={!challengeStarted && challenge.previousChallengeId ? challenge.previousChallengeId : challenge.id} />
          </>
        ) : null}
        {user?.isAdmin && (
          <div className="mt-8 text-center">
            <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-yellow-400 underline">
              Go to Admin Dashboard
            </button>
          </div>
        )}
        {user && <ScoringCriteria isTestUser={isTestUser} />}
      </div>
    );
  }

  if (isBlockedApp) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-gray-900 z-[9999] fixed inset-0">
        <div className="bg-red-900 border-4 border-red-500 p-8 rounded-2xl shadow-2xl max-w-md w-full mx-auto z-50">
          <div className="text-7xl mb-6">⚠️</div>
          <h2 className="text-3xl font-bold text-white mb-6 uppercase tracking-wider">App Deprecated</h2>
          <p className="text-gray-100 text-xl font-semibold mb-8">
            This version of the app is no longer supported. Please uninstall it and download the new <span className="text-yellow-400">SMYM Christian Games</span> app from the Google Play Store to continue playing.
          </p>
          <button
            onClick={() => {
              window.open('https://play.google.com/store/apps/details?id=com.tesarsoft.smym.christiangames', '_system');
            }}
            className="w-full bg-white text-red-900 font-bold py-4 px-8 rounded-xl text-xl uppercase tracking-wide shadow-lg mb-4 transition-transform transform hover:scale-105"
          >
            Open Play Store
          </button>
          {user && (
            <div className="mt-4 text-gray-300 font-medium bg-red-800/50 p-4 rounded-xl border border-red-700">
              {deprecationEmailSending && <p className="animate-pulse">Checking email status...</p>}
              {deprecationEmailStatus && deprecationEmailStatus.sent && (
                <p>A link to the new app has just been sent to your email.</p>
              )}
              {deprecationEmailStatus && !deprecationEmailStatus.sent && (
                <p>A link to the new app was previously sent to your email on {new Date(deprecationEmailStatus.timestamp).toLocaleDateString()}.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <IonApp>
      {locationPath.startsWith('/game/') ? (
        <header className="bg-gray-800 shadow-md relative z-20 pt-safe-top">
          <div className="container mx-auto px-4 py-3 flex items-center">
            <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-gray-300 hover:text-yellow-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              <span className="font-medium text-sm">Home</span>
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

          <ChunkErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              {renderContent()}
            </Suspense>
          </ChunkErrorBoundary>
        </main>

        <AddToHomeScreen />
        {showChristmasFlair && <Suspense fallback={null}><ChristmasFlair /></Suspense>}
      </IonContent>
    </IonApp >
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