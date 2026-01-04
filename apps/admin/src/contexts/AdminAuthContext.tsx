'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser
} from 'firebase/auth';

import { firebaseAuth } from '../lib/firebase';

export interface AdminUser {
  id: string;
  email: string;
}

export interface AdminAuthContextValue {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

interface AdminAuthProviderProps {
  children: ReactNode;
}

const INITIAL_LOADING = true;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;

const SIGNIN_FAILED_MESSAGE = 'Invalid email or password.';
const NOT_ADMIN_MESSAGE = 'Access denied. Admin privileges required.';
const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';
const SIGN_OUT_MESSAGE = 'Unable to sign out. Please try again.';

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

async function checkAdminClaim(user: FirebaseUser): Promise<boolean> {
  try {
    const idTokenResult = await user.getIdTokenResult();
    const claims = idTokenResult.claims;
    return Boolean(claims.admin);
  } catch {
    return false;
  }
}

function toAdminUser(firebaseUser: FirebaseUser): AdminUser {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? ''
  };
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps): JSX.Element {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(INITIAL_LOADING);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const firebaseUser = credential.user;

      const isAdmin = await checkAdminClaim(firebaseUser);
      if (!isAdmin) {
        await firebaseSignOut(firebaseAuth);
        throw new Error(NOT_ADMIN_MESSAGE);
      }
    } catch (error) {
      if (error instanceof Error && error.message === NOT_ADMIN_MESSAGE) {
        throw error;
      }
      const message = error instanceof Error ? error.message : SIGNIN_FAILED_MESSAGE;
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await firebaseSignOut(firebaseAuth);
      setUser(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : SIGN_OUT_MESSAGE;
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAuthStateChanged = useCallback(async (firebaseUser: FirebaseUser | null): Promise<void> => {
    if (!firebaseUser) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const isAdmin = await checkAdminClaim(firebaseUser);
      if (!isAdmin) {
        await firebaseSignOut(firebaseAuth);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setUser(toAdminUser(firebaseUser));
    } catch {
      await firebaseSignOut(firebaseAuth);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): (() => void) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser): void => {
      void handleAuthStateChanged(firebaseUser);
    });

    return unsubscribe;
  }, [handleAuthStateChanged]);

  const value = useMemo<AdminAuthContextValue>(
    (): AdminAuthContextValue => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      signIn,
      signOut
    }),
    [user, isLoading, signIn, signOut]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('AdminAuthContext not available');
  }
  return context;
}
