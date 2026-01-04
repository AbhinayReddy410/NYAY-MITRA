import type { FirebaseApp } from 'firebase/app';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const EMPTY_STRING = '';
const EMPTY_COUNT = 0;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? EMPTY_STRING,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? EMPTY_STRING,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? EMPTY_STRING
};

const firebaseApp: FirebaseApp = getApps().length > EMPTY_COUNT ? getApp() : initializeApp(firebaseConfig);
const firebaseAuth: Auth = getAuth(firebaseApp);

export { firebaseApp, firebaseAuth };
