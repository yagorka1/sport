import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.egor.sportstats',
  appName: 'Статистика спорта',
  // Matches outputPath in angular.json.
  webDir: 'www',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
