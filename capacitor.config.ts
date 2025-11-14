import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tesarsoft.smym.biblegames', // Your log shows 'com.tesarsoft.smym.biblegames', make sure this matches
  appName: 'SMYM Bible Games',
  webDir: 'dist', // The build output of Vite
  server: {
    // androidScheme: 'https', // REMOVED
    // cleartext: true, // REMOVED - Use HTTPS!
    url: '[https://youth.columbuschurch.org](https://youth.columbuschurch.org)', // ADD THIS
    // This tells the app to load its content from your live server
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
