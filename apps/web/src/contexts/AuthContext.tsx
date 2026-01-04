'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { Auth, User as FirebaseUser } from 'firebase/auth';

import type { ApiResponse, User as DomainUser } from '@nyayamitra/shared';

import { apiClient } from '@/lib/api';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  profile: DomainUser | null;
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

async function fetchProfile(token: string): Promise<DomainUser> {
  const response = await apiClient
    .get('user/profile', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<ApiResponse<DomainUser>>();

  return response.data;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [firebaseAuth, setFirebaseAuth] = useState<Auth | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<DomainUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [firebaseError, setFirebaseError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initFirebase = async (): Promise<void> => {
      try {
        const { getFirebaseAuth, getFirebaseError } = await import('@/lib/firebase');
        if (!isMounted) {
          return;
        }

        const auth = getFirebaseAuth();
        const error = getFirebaseError();

        if (error) {
          setFirebaseError(error);
          setIsLoading(false);
          return;
        }

        setFirebaseAuth(auth);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const resolved = error instanceof Error ? error : new Error('Firebase initialization failed');
        setFirebaseError(resolved);
        setIsLoading(false);
      }
    };

    void initFirebase();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!firebaseAuth) {
      if (firebaseError) {
        setIsLoading(false);
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const token = await user.getIdToken();
        const data = await fetchProfile(token);
        setProfile(data);
      } catch {
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [firebaseAuth, firebaseError]);

  const signInWithGoogle = async (): Promise<void> => {
    if (!firebaseAuth) {
      throw new Error('Firebase not initialized');
    }
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(firebaseAuth, provider);
  };

  const signInWithPhone = async (phoneNumber: string): Promise<void> => {
    void phoneNumber;
    throw new Error('Phone auth not implemented yet');
  };

  const verifyOtp = async (code: string): Promise<void> => {
    void code;
    throw new Error('OTP verification not implemented yet');
  };

  const signOut = async (): Promise<void> => {
    if (!firebaseAuth) {
      throw new Error('Firebase not initialized');
    }
    const { signOut: firebaseSignOut } = await import('firebase/auth');
    await firebaseSignOut(firebaseAuth);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        isLoading,
        isAuthenticated: Boolean(firebaseUser),
        error: firebaseError,
        signInWithGoogle,
        signInWithPhone,
        verifyOtp,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
