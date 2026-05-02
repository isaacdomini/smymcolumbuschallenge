import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tesarsoft.smym.biblegames',
  appName: 'SMYM Bible Games',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  server: {
    url: "https://smymgame.tesarsoft.com",
    allowNavigation: [
      "smymgame.tesarsoft.com",
      "*.smymgame.tesarsoft.com"
    ]
  }
};

export default config;