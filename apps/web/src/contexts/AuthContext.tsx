'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';

// Lazy import to catch initialization errors
let auth: ReturnType<typeof import('firebase/auth').getAuth> | null = null;
let firebaseError: Error | null = null;

try {
  const firebase = require('@/lib/firebase');
  auth = firebase.auth;
} catch (error) {
  firebaseError = error instanceof Error ? error : new Error('Firebase initialization failed');
  console.error('Firebase initialization error:', firebaseError.message);
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  signInWithGoogle: () => Promise<void>;
  signInWithPhone: (phoneNumber: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth || firebaseError) {
      setIsLoading(false);
      return;
    }

    const { onAuthStateChanged } = require('firebase/auth');
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      setUser(user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Show configuration error
  if (firebaseError) {
    return (
      <div
        style={{
          padding: '2rem',
          maxWidth: '600px',
          margin: '2rem auto',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px'
        }}
      >
        <h2 style={{ color: '#dc2626', marginTop: 0 }}>Firebase Configuration Error</h2>
        <pre
          style={{
            backgroundColor: '#1f2937',
            color: '#f3f4f6',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '0.875rem'
          }}
        >
          {firebaseError.message}
        </pre>
      </div>
    );
  }

  const signInWithGoogle = async (): Promise<void> => {
    if (!auth) throw new Error('Firebase not initialized');
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithPhone = async (phoneNumber: string): Promise<void> => {
    throw new Error('Phone auth not implemented yet');
  };

  const verifyOtp = async (code: string): Promise<void> => {
    throw new Error('OTP verification not implemented yet');
  };

  const handleSignOut = async (): Promise<void> => {
    if (!auth) throw new Error('Firebase not initialized');
    const { signOut: firebaseSignOut } = await import('firebase/auth');
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        error: firebaseError,
        signInWithGoogle,
        signInWithPhone,
        verifyOtp,
        signOut: handleSignOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
