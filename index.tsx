import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/* Core Ionic styles */
import '@ionic/react/css/core.css';

/* Optional Ionic utilities and structure */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';

// --- THIS IS THE CORRECTED PATH ---
/* Import Ionic dark theme */
import '@ionic/react/css/palettes/dark.always.css';
// ----------------------------------

/* Initialize Ionic */
import { setupIonicReact } from '@ionic/react';
setupIonicReact();

// Intercept Vite's automatic chunk reload to prevent infinite loops and 429s
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event: any) => {
    // Prevent Vite from automatically calling location.reload() infinitely
    event.preventDefault();
    
    const lastReload = sessionStorage.getItem('chunk_reload_time');
    const now = Date.now();
    
    // If we reloaded less than 10 seconds ago, don't reload again
    if (lastReload && now - parseInt(lastReload, 10) < 10000) {
      console.error('Vite chunk load error persists after reload. Stopping infinite loop.');
      // The React ChunkErrorBoundary in App.tsx will catch the resulting promise rejection and show the fallback UI
      return;
    }
    
    sessionStorage.setItem('chunk_reload_time', now.toString());
    console.warn('Vite chunk load error caught. Forcing cache-busted reload...');
    
    // Use query param to aggressively bust the webview cache instead of just reloading
    const url = new URL(window.location.href);
    url.searchParams.set('v', now.toString());
    window.location.href = url.toString();
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);