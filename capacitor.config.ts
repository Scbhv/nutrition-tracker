import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.1764e64444c74500bf0b0dd59c1a1055',
  appName: 'nutrition-trackerapp',
  webDir: 'dist',
  server: {
    url: 'https://1764e644-44c7-4500-bf0b-0dd59c1a1055.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#141614',
  },
  android: {
    backgroundColor: '#141614',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#141614',
      showSpinner: false,
    },
  },
};

export default config;
