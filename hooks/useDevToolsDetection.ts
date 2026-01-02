import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import * as api from '@/services/api';

export const useDevToolsDetection = () => {
  const { user } = useAuth();
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const threshold = 160; // Minimum width/height of dev tools panel

    const report = (method: string) => {
      if (reportedRef.current) return;

      const details = `Detected via: ${method}
      Outer: ${window.outerWidth}x${window.outerHeight}
      Inner: ${window.innerWidth}x${window.innerHeight}
      Diff: ${window.outerWidth - window.innerWidth}x${window.outerHeight - window.innerHeight}`;

      console.log("DevTools usage detected (simulated log for debugging)");

      // Report to server
      api.reportCheating(user.id, details);
      reportedRef.current = true;
    };

    // 1. Dimension Check
    const checkDimensions = () => {
      if (reportedRef.current) return;

      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (
        !(heightThreshold && widthThreshold) &&
        ((window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) || widthThreshold || heightThreshold)
      ) {
        report('Dimension Check');
      }
    };

    // 2. Console Object Check (Advanced)
    // This works because when the console is open, it tries to evaluate the id property
    const checkConsole = () => {
      if (reportedRef.current) return;

      const element = new Image();
      Object.defineProperty(element, 'id', {
        get: function () {
          report('Console Object Check');
          return 'detected';
        },
      });
      // This log triggers the getter ONLY if dev tools is open and inspecting objects
      console.log('%c', element);
    };

    // 3. Keyboard Shortcuts Prevention
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        // We can also report this attempt, but maybe too aggressive?
        // report('F12 Key Press'); 
      }

      // Ctrl+Shift+I (Inspector)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        e.stopPropagation();
        report('Ctrl+Shift+I Shortcut');
      }

      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        e.stopPropagation();
        report('Ctrl+Shift+J Shortcut');
      }

      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        e.stopPropagation();
      }

      // Cmd+Option+I (Mac Inspector)
      if (e.metaKey && e.altKey && e.key === 'i') {
        e.preventDefault();
        e.stopPropagation();
        report('Cmd+Opt+I Shortcut');
      }
    };

    // 4. Right Click Prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Attach Listeners
    window.addEventListener('resize', checkDimensions);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    // Periodic Checks
    const interval = setInterval(() => {
      checkDimensions();
      checkConsole();
    }, 2000);

    // Initial check
    checkDimensions();
    checkConsole();

    return () => {
      window.removeEventListener('resize', checkDimensions);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
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
