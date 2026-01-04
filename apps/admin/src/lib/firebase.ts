import type { FirebaseApp } from 'firebase/app';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let initError: Error | null = null;

function getFirebaseConfig(): Record<string, string> {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ''
  };
}

function isConfigValid(): boolean {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.authDomain && config.projectId);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (app) return app;
  if (initError) return null;

  if (!isConfigValid()) {
    initError = new Error('Missing Firebase environment variables');
    return null;
  }

  try {
    app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
    return app;
  } catch (error) {
    initError = error instanceof Error ? error : new Error('Firebase initialization failed');
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  try {
    auth = getAuth(firebaseApp);
    return auth;
  } catch (error) {
    initError = error instanceof Error ? error : new Error('Firebase auth initialization failed');
    return null;
  }
}

export function getFirebaseError(): Error | null {
  return initError;
}

export async function getCurrentUserToken(): Promise<string> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase not initialized');
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  return await currentUser.getIdToken();
}

// Backward compatibility exports
export const firebaseApp = getFirebaseApp();
export const firebaseAuth = getFirebaseAuth();
