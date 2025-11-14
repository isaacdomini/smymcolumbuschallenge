import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useLogger } from './hooks/useLogger'; // IMPORT NEW HOOK
import Header from './components/Header';
import Countdown from './components/dashboard/Countdown';
import Leaderboard from './components/dashboard/Leaderboard';
import WordleGame from './components/game/WordleGame';
import ConnectionsGame from './components/game/ConnectionsGame';
import CrosswordGame from './components/game/CrosswordGame';
import ChallengeHistory from './components/dashboard/ChallengeHistory';
import ChallengeIntro from './components/dashboard/ChallengeIntro';
import ResetPassword from './components/auth/ResetPassword';
import AdminDashboard from './components/admin/AdminDashboard';
import PrivacyPolicy from './components/PrivacyPolicy'; // Import the new component
import DeleteAccount from './components/auth/DeleteAccount'; // Import the new component
import { Game, GameType, Challenge, GameSubmission, User } from './types';
import { getChallenge, getDailyGame, getLeaderboard, getSubmissionForToday, getGamesForChallenge, getSubmissionsForUser } from './services/api';
import ScoringCriteria from './components/dashboard/ScoringCriteria';
import AddToHomeScreen from './components/ui/AddToHomeScreen';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
// Import the Capacitor App plugin
import { App as CapacitorApp } from '@capacitor/app';
// Import the PushNotifications plugin
import { PushNotifications } from '@capacitor/push-notifications';
// [REMOVED] import { Badge } from '@capacitor/badge';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
};

const MainContent: React.FC = () => {
  useLogger(); // ACTIVATE LOGGER HERE
  const { user } = useAuth();
  // ... rest of the file remains exactly the same
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [todaysGame, setTodaysGame] = useState<Game | null>(null);
  const [todaysSubmission, setTodaysSubmission] = useState<GameSubmission | null>(null);
  
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
            // Try to get Android status bar height from the plugin
            try {
              const info = await StatusBar.getInfo();
              // Use 'as any' to bypass TS error if types are old/mismatched
              // This checks if the property exists at runtime.
              const androidHeight = (info as any).statusBarHeight; 
              
              if (androidHeight > 0) {
                height = androidHeight;
              } else {
                // Fallback if property doesn't exist or is 0
                console.warn('Could not read statusBarHeight from plugin, using 24px default for Android.');
                height = 24; // A common default pixel height for Android status bars
              }
            } catch (e) {
              console.error("Failed to get status bar info, using 24px default.", e);
              height = 24; // A common default
            }
          }
          
          // Set the CSS variable.
          // For iOS, height remains 0, so the CSS fallback 'env(safe-area-inset-top)' will be used.
          // For Android, this will be 24px (or the actual height), overriding the fallback.
          document.documentElement.style.setProperty(
            '--safe-area-inset-top-js', 
            `${height}px`
          );

          // Ensure the status bar icons (time, battery) are light-colored
          await StatusBar.setStyle({ style: 'light' }); 
        
        } catch (e) {
          console.error("Failed to set status bar style", e);
        }
      }
    };

    // --- Add Back Button Listener ---
    const addBackButtonListener = () => {
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          // We use window.location.pathname to check our *React* route
          // not the 'canGoBack' property from the event, which checks the webView history.
          // We are managing history ourselves with 'navigate'.
          if (window.location.pathname !== '/') {
            // If we are on a sub-page, go back
            window.history.back();
          } else {
            // If we are on the home page, exit the app (Android only)
            CapacitorApp.exitApp();
          }
        });
      }
    };
    // --- End of Back Button Listener ---

    // --- Add App Resume Listener to Clear Badges ---
    const addResumeListener = () => {
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.addListener('resume', async () => {
          try {
            // Clear all notifications from the notification center
            await PushNotifications.removeAllDeliveredNotifications();
            // Reset the app icon badge count to 0
            await PushNotifications.setBadge({ count: 0 });
          } catch (err) {
            console.error("Error clearing notifications or badge count on resume", err);
          }
        });
      }
    };
    // --- End of Resume Listener ---

    // --- Initial Badge Clear on Load ---
    // Also clear the badge when the app is first loaded, not just on resume
    const clearBadgeOnLoad = async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                // We do this on a slight delay to ensure permissions are ready
                setTimeout(async () => {
                    await PushNotifications.removeAllDeliveredNotifications();
                    // Reset the app icon badge count to 0
                    await PushNotifications.setBadge({ count: 0 });
                }, 1000);
            } catch (err) {
                 console.error("Error clearing badge on load", err);
            }
        }
    }
    // --- End of Initial Badge Clear ---

    setStatusBarPadding();
    addBackButtonListener(); // Call the listener setup
    addResumeListener(); // Call the new listener setup
    clearBadgeOnLoad(); // Call the initial clear
  }, []); // Empty dependency array, runs once


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
    // Don't fetch if we are on special routes
    if (locationPath.startsWith('/reset-password') || locationPath.startsWith('/admin') || locationPath.startsWith('/privacy') || locationPath.startsWith('/request-deletion')) {
        setIsLoading(false);
        // If on admin but not admin user, redirect home handled in render
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

        // Always fetch games for history, even if challenge hasn't started
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
                // We might have already fetched submissions above
                const submissions = allUserSubmissions.length > 0 ? allUserSubmissions : (user ? await getSubmissionsForUser(user.id, currentChallenge.id) : []);
                const todaySub = submissions.find(s => s.gameId === game.id) ?? null;
                setTodaysSubmission(todaySub);
            } else {
                setTodaysSubmission(null);
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
  }, [user, locationPath]); // depend on user and locationPath

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
    if (locationPath.startsWith('/reset-password')) {
        return <ResetPassword />;
    }

    // ADDED: Privacy Policy Route
    if (locationPath.startsWith('/privacy')) {
        return <PrivacyPolicy onBack={() => navigate('/')} onNavigateToDeleteAccount={() => navigate('/request-deletion')} />;
    }

    // ADDED: Account Deletion Route
    if (locationPath.startsWith('/request-deletion')) {
        return <DeleteAccount onBack={() => navigate('/')} />;
    }

    // ADDED: Admin Route
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
            
            {/* Show Countdown if challenge hasn't started */}
            {!challengeStarted && challenge ? (
                <Countdown targetDate={challenge.startDate} />
            ) : null}
            
            {/* Show buttons if challenge has started */}
            {challengeStarted && (
                <div className="mb-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                    {user ? (
                        <>
                            <button 
                                onClick={() => todaysGame && navigate(`/game/${todaysGame.id}`)}
                                disabled={!todaysGame}
                                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-lg text-xl shadow-lg transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                {todaysGame ? (todaysSubmission ? "Revisit Today's Game" : "Play Today's Game") : "No Game Today"}
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
            
            {/* Show Leaderboard if challenge has started */}
            {challengeStarted && challenge ? (
                <LeaderboardWrapper challengeId={challenge.id} />
            ) : null}
            
            {/* Admin Link on Home if applicable */}
            {user?.isAdmin && (
                 <div className="mt-8 text-center">
                    <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-yellow-400 underline">
                        Go to Admin Dashboard
                    </button>
                 </div>
            )}

            <ScoringCriteria />
        </div>
    );
  }

  return (
    // Updated to h-full and overflow-y-auto for full-screen mobile experience
    <div className="h-full overflow-y-auto bg-gray-900 text-gray-100 font-sans pb-20">
      <Header challengeName={challenge?.name} onLogoClick={() => navigate('/')} />
      {/* Added safe-area padding for iOS notches/home bar when in full-screen */}
      <main className="container mx-auto p-4 md:p-6 pt-safe-top pb-safe-bottom">
        {globalMessage && (
          <div className="mb-4 p-4 text-center bg-green-700 text-white rounded-lg shadow-lg animate-fade-in">
            {globalMessage}
          </div>
        )}
        {renderContent()}
      </main>
      <AddToHomeScreen />
    </div>
  );
};

const LeaderboardWrapper: React.FC<{ challengeId: string }> = ({ challengeId }) => {
    const [leaderboardData, setLeaderboardData] = useState<(GameSubmission & { user: User })[]>([]);
    useEffect(() => {
        if(challengeId) {
            getLeaderboard(challengeId).then(setLeaderboardData).catch(err => {
                console.error("Failed to load leaderboard", err);
                setLeaderboardData([]);
            });
        }
    }, [challengeId]);

    return <Leaderboard data={leaderboardData} />;
}

export default App;