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
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? '',
      EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? ''
    }
  };
};

export = config;
