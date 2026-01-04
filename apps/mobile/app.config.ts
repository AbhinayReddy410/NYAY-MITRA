import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_NAME = 'NyayaMitra';
const APP_SLUG = 'nyayamitra';

const config = ({ config: baseConfig }: ConfigContext): ExpoConfig => {
  return {
    ...baseConfig,
    name: APP_NAME,
    slug: APP_SLUG,
    plugins: ['expo-router'],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
      firebaseWebClientId: process.env.EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID ?? '',
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? ''
    }
  };
};

export default config;
