import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tesarsoft.smym.biblegames',
  appName: 'SMYM Bible Games',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
