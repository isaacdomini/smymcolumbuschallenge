import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tesarsoft.smym.biblegames', // Your log shows 'com.tesarsoft.smym.biblegames', make sure this matches
  appName: 'SMYM Bible Games',
  webDir: 'dist', // The build output of Vite
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  server: {
    url: "https://youth.columbuschurch.org",
    allowNavigation: [
      "youth.columbuschurch.org",
      "*.youth.columbuschurch.org"
    ]
  }
};

export default config;