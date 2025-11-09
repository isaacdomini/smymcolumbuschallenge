import { useEffect } from 'react';
import { useAuth } from './useAuth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const useLogger = () => {
    const { user } = useAuth();

    useEffect(() => {
        const logView = async () => {
            try {
                await fetch(`${API_BASE_URL}/log`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: window.location.pathname + window.location.search,
                        userId: user?.id || null
                    })
                });
            } catch (error) {
                // Silent error, logging shouldn't break the app
            }
        };

        // Initial log
        logView();

        // Listen for popstate events (browser back/forward)
        window.addEventListener('popstate', logView);

        // Since we are using a simplified routing without a real router library,
        // we need to hook into our custom navigation or monkey-patch history.
        // A cleaner way for now is to expose a manual log function or 
        // just rely on the fact that our App re-renders on navigation if we update state.
        
        // Better yet, monkey-patch pushState/replaceState to catch all client-side navigations
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            logView();
        };

        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            logView();
        };

        return () => {
            window.removeEventListener('popstate', logView);
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;
        };
    }, [user?.id]); // Re-run when user changes to log with new ID
};