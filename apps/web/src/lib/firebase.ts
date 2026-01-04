import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
] as const;

function validateEnv(): void {
  const missing = requiredEnvVars.filter(
    (key) =>
      !process.env[key] ||
      process.env[key] === `your-${key.toLowerCase().replace('next_public_firebase_', '')}-here`
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase environment variables: ${missing.join(', ')}\n\n` +
        `To fix this:\n` +
        `1. Copy apps/web/.env.local.example to apps/web/.env.local\n` +
        `2. Fill in your Firebase credentials from Firebase Console\n` +
        `3. Restart the dev server\n`
    );
  }
}

function getFirebaseConfig(): Record<string, string> {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? ''
  };
}

function initializeFirebase(): FirebaseApp {
  validateEnv();

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(getFirebaseConfig());
}

export const app: FirebaseApp = initializeFirebase();
export const auth: Auth = getAuth(app);
