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