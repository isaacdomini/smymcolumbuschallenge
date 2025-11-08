import React, { useState, useEffect } from 'react';

const AddToHomeScreen: React.FC = () => {
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        // Check if it's an iOS device
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        
        // Check if already in standalone mode (added to home screen)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

        // Check if user has already dismissed the banner
        const hasDismissed = localStorage.getItem('smym-dismissed-a2hs');

        if (isIOS && !isStandalone && !hasDismissed) {
            // Delay showing the banner slightly so it doesn't feel aggressive
            const timer = setTimeout(() => setShowBanner(true), 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('smym-dismissed-a2hs', 'true');
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-yellow-500/30 p-4 shadow-2xl z-50 animate-slide-up">
            <div className="max-w-md mx-auto flex flex-col space-y-3">
                 <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-yellow-400 text-lg">Install App</h3>
                        <p className="text-gray-300 text-sm mt-1">
                            Add to your Home Screen for fast access.<br />
                            <span className="text-blue-400">This also allows us to remind you to complete your daily challenges!</span>
                        </p>
                    </div>
                    <button onClick={handleDismiss} className="text-gray-400 hover:text-white p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className="flex items-center text-sm text-gray-400 space-x-2 bg-gray-900/50 p-3 rounded-lg">
                     <span>Tap</span>
                     {/* Share Icon */}
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                     <span>then select <strong>"Add to Home Screen"</strong></span>
                     {/* Plus Square Icon */}
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                </div>
            </div>
            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.5s ease-out;
                }
            `}</style>
        </div>
    );
};

export default AddToHomeScreen;
