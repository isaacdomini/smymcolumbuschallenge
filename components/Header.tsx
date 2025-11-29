import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import AuthModal from './auth/AuthModal';
import { ICONS } from '../constants';
import Tooltip from './ui/Tooltip';

interface HeaderProps {
    challengeName?: string;
    onLogoClick?: () => void;
    navigate: (path: string) => void;
}

const Header: React.FC<HeaderProps> = ({ challengeName, onLogoClick, navigate }) => {
    const { user, logout } = useAuth();
    const [isAuthModalOpen, setAuthModalOpen] = useState(false);
    const { isSupported, isSubscribed, notificationPermission, subscribeToPush } = usePushNotifications();
    const [showPushPopup, setShowPushPopup] = useState(false);
    const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Show popup if:
        // 1. User is logged in
        // 2. Notifications are supported
        // 3. Permission is 'default' (not yet granted or denied)
        // 4. User hasn't seen/dismissed it on this device yet
        if (user && isSupported && notificationPermission === 'default') {
            const hasSeenPopup = localStorage.getItem('smym-seen-push-popup');
            if (!hasSeenPopup) {
                // Small delay to not overwhelm user immediately upon login
                const timer = setTimeout(() => setShowPushPopup(true), 1000);
                return () => clearTimeout(timer);
            }
        } else {
            setShowPushPopup(false);
        }
    }, [user, isSupported, notificationPermission]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleDismissPopup = () => {
        setShowPushPopup(false);
        localStorage.setItem('smym-seen-push-popup', 'true');
    };

    const handleSubscribeClicked = () => {
        handleDismissPopup(); // Dismiss popup if they click the bell
        subscribeToPush();
    };

    return (
        <>
            <header className="bg-gray-800 shadow-md relative z-20 pt-safe-top">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div onClick={onLogoClick} className="flex items-center space-x-3 cursor-pointer">
                        {ICONS.smymLogo}
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-yellow-400">SMYM Christian Challenges</h1>
                            {challengeName && <p className="text-xs text-gray-400 hidden sm:block">{challengeName}</p>}
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        {user ? (
                            <>
                                {isSupported && !isSubscribed && notificationPermission !== 'denied' && (
                                    <div className="relative">
                                        <Tooltip text="Enable daily reminders">
                                            <button
                                                onClick={handleSubscribeClicked}
                                                className="p-2 text-gray-400 hover:text-yellow-400 transition-colors relative"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                                                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                                                </svg>
                                                {/* Pulsing dot to draw initial attention if popup is showing */}
                                                {showPushPopup && (
                                                    <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
                                                    </span>
                                                )}
                                            </button>
                                        </Tooltip>
                                        {/* Reminder Popup */}
                                        {showPushPopup && (
                                            <div className="absolute top-full right-0 mt-3 w-60 bg-blue-600 text-white p-3 rounded-lg shadow-xl z-50 animate-fade-in">
                                                {/* Arrow pointing up to bell */}
                                                <div className="absolute top-0 right-3 -mt-2 border-4 border-transparent border-b-blue-600"></div>
                                                <p className="text-sm font-medium mb-2">
                                                    Never miss a daily challenge! Click the bell to enable reminders on this device.
                                                </p>
                                                <button
                                                    onClick={handleDismissPopup}
                                                    className="text-xs text-blue-200 hover:text-white underline transition-colors"
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="relative" ref={profileMenuRef}>
                                    <button onClick={() => setProfileMenuOpen(!isProfileMenuOpen)} className="flex items-center space-x-2 cursor-pointer">
                                        <span className="hidden sm:inline text-gray-300">{user.name}</span>
                                        <div className="p-2 bg-gray-700 rounded-full">{ICONS.user}</div>
                                    </button>
                                    {isProfileMenuOpen && (
                                        <div className="absolute top-full right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg z-50">
                                            <button
                                                onClick={() => {
                                                    navigate('/profile');
                                                    setProfileMenuOpen(false);
                                                }}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                                            >
                                                Profile
                                            </button>
                                            {user.isAdmin && (
                                                <button
                                                    onClick={() => {
                                                        navigate('/admin');
                                                        setProfileMenuOpen(false);
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                                                >
                                                    Admin Dashboard
                                                </button>
                                            )}
                                            <button
                                                onClick={logout}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                                            >
                                                Logout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <button
                                onClick={() => setAuthModalOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Login / Sign Up
                            </button>
                        )}
                    </div>
                </div>
            </header>
            {isAuthModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
        </>
    );
};

export default Header;