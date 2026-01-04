import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let initError: Error | null = null;

function getFirebaseConfig(): Record<string, string> {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? ''
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
    initError = new Error(
      'Missing Firebase environment variables: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID\n\n' +
        'To fix this:\n' +
        '1. Copy apps/web/.env.local.example to apps/web/.env.local\n' +
        '2. Fill in your Firebase credentials from Firebase Console\n' +
        '3. Restart the dev server\n'
    );
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

  // Check for E2E test mock
  if (typeof window !== 'undefined' && (window as any).__FIREBASE_MOCK_USER__) {
    const mockUser = (window as any).__FIREBASE_MOCK_USER__;
    auth = {
      app: { name: '[DEFAULT]', options: {} } as any,
      currentUser: mockUser,
      name: 'mock-auth',
      config: {} as any,
      languageCode: null,
      tenantId: null,
      settings: {} as any,
      onAuthStateChanged: (callback: (user: any) => void) => {
        setTimeout(() => callback(mockUser), 0);
        return () => {};
      },
      beforeAuthStateChanged: () => () => {},
      onIdTokenChanged: (callback: (user: any) => void) => {
        setTimeout(() => callback(mockUser), 0);
        return () => {};
      },
      updateCurrentUser: async () => {},
      useDeviceLanguage: () => {},
      signOut: async () => {},
    } as any;
    return auth;
  }

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

// Backward compatibility exports
export { app, auth };
