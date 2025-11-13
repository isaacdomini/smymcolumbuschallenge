import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tesarsoft.smym.biblegames', // Your log shows 'com.tesarsoft.smym.biblegames', make sure this matches
  appName: 'SMYM Bible Games',
  webDir: 'dist', // The build output of Vite
  server: {
    androidScheme: 'https',
    // --- Add this to allow http:// traffic to your local IP ---
    cleartext: true,
    // ---------------------------------------------------------
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;