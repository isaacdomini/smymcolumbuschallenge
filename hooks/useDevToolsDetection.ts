import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import * as api from '@/services/api';

export const useDevToolsDetection = () => {
  const { user } = useAuth();
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const threshold = 160; // Minimum width/height of dev tools panel

    const checkDevTools = () => {
      if (reportedRef.current) return;

      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (
        !(heightThreshold && widthThreshold) &&
        ((window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) || widthThreshold || heightThreshold)
      ) {
        // Double check it's not just a resized window (not perfect, but a heuristic)
        // Usually dev tools take up some space.
        // If both are true, it might be a maximized window on some OSs? No, usually outer > inner only by borders.

        // Let's refine: 
        // If the difference is significant, it's likely a docked panel.
        // Undocked dev tools are harder to detect with this method.

        const details = `Detected via dimension check. 
        Outer: ${window.outerWidth}x${window.outerHeight}
        Inner: ${window.innerWidth}x${window.innerHeight}
        Diff: ${window.outerWidth - window.innerWidth}x${window.outerHeight - window.innerHeight}`;

        console.log("DevTools usage detected (simulated log for debugging)");

        // Report to server
        api.reportCheating(user.id, details);
        reportedRef.current = true;
      }
    };

    // Check on resize
    window.addEventListener('resize', checkDevTools);

    // Check periodically (for undocked or already open)
    const interval = setInterval(() => {
      // Advanced check for undocked dev tools using console object (works in some browsers)
      // This is a bit hacky and browser specific.
      // For now, we'll stick to the dimension check as a primary heuristic.
      checkDevTools();
    }, 2000);

    return () => {
      window.removeEventListener('resize', checkDevTools);
      clearInterval(interval);
    };
  }, [user]);
};

// Add type definition for Firebug if needed, or just use 'any' above
declare global {
  interface Window {
    Firebug?: any;
  }
}
