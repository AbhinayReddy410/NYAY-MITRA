'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { HTTPError } from 'ky';
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
  type ConfirmationResult,
  type User as FirebaseUser
} from 'firebase/auth';

import { ERROR_CODES, type ApiResponse, type User } from '@nyayamitra/shared';

import { apiClient } from '../lib/api';
import { firebaseAuth } from '../lib/firebase';

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  photoURL?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithPhone: (phoneNumber: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

type UserProfileResponse = User & { draftsLimit: number };

const INITIAL_LOADING = true;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const INDIA_COUNTRY_CODE = '+91';
const RECAPTCHA_CONTAINER_ID = 'recaptcha-container';
const RECAPTCHA_SIZE = 'invisible';
const EMPTY_STRING = '';

const GOOGLE_SIGNIN_FAILED_MESSAGE = 'Unable to sign in with Google. Please try again.';
const PHONE_INVALID_MESSAGE = 'Please enter a valid phone number.';
const PHONE_SIGNIN_FAILED_MESSAGE = 'Unable to send OTP. Please try again.';
const OTP_MISSING_MESSAGE = 'Please request a new OTP.';
const OTP_VERIFY_FAILED_MESSAGE = 'Unable to verify OTP. Please try again.';
const PROFILE_LOAD_MESSAGE = 'Unable to load your profile.';
const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';
const SIGN_OUT_MESSAGE = 'Unable to sign out. Please try again.';

const AuthContext = createContext<AuthContextValue | null>(null);
const googleProvider = new GoogleAuthProvider();

function normalizeOptional(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

function formatPhoneNumber(phoneNumber: string): string {
  const trimmed = phoneNumber.trim();
  if (!trimmed) {
    return EMPTY_STRING;
  }
  if (trimmed.startsWith('+')) {
    return trimmed;
  }
  return `${INDIA_COUNTRY_CODE}${trimmed}`;
}

function toAuthUser(profile: UserProfileResponse): AuthUser {
  return {
    id: profile.uid,
    email: normalizeOptional(profile.email),
    phone: normalizeOptional(profile.phone)
  };
}

function toAuthUserFromFirebase(user: FirebaseUser): AuthUser {
  return {
    id: user.uid,
    email: normalizeOptional(user.email),
    phone: normalizeOptional(user.phoneNumber),
    photoURL: normalizeOptional(user.photoURL)
  };
}

async function fetchUserProfile(token: string): Promise<AuthUser> {
  if (!token) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  try {
    const response = await apiClient
      .get('user/profile', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .json<ApiResponse<UserProfileResponse>>();

    return toAuthUser(response.data);
  } catch (error) {
    if (error instanceof HTTPError) {
      const status = error.response.status;
      if (status === HTTP_STATUS_UNAUTHORIZED || status === HTTP_STATUS_FORBIDDEN) {
        throw new Error(SESSION_EXPIRED_MESSAGE);
      }

      const data = (await error.response.clone().json().catch((): null => null)) as
        | { error?: { code?: string } }
        | null;

      if (data?.error?.code === ERROR_CODES.AUTH_REQUIRED || data?.error?.code === ERROR_CODES.AUTH_INVALID) {
        throw new Error(SESSION_EXPIRED_MESSAGE);
      }
    }

    throw new Error(PROFILE_LOAD_MESSAGE);
  }
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(INITIAL_LOADING);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (error) {
      const message = error instanceof Error ? error.message : GOOGLE_SIGNIN_FAILED_MESSAGE;
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithPhone = useCallback(async (phoneNumber: string): Promise<void> => {
    const formatted = formatPhoneNumber(phoneNumber);
    if (!formatted) {
      throw new Error(PHONE_INVALID_MESSAGE);
    }
    if (typeof window === 'undefined') {
      throw new Error(PHONE_SIGNIN_FAILED_MESSAGE);
    }

    setIsLoading(true);
    try {
      const existing = recaptchaRef.current;
      if (existing) {
        existing.clear();
        recaptchaRef.current = null;
      }

      recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, RECAPTCHA_CONTAINER_ID, {
        size: RECAPTCHA_SIZE
      });

      const confirmation = await signInWithPhoneNumber(firebaseAuth, formatted, recaptchaRef.current);
      confirmationRef.current = confirmation;
    } catch (error) {
      const message = error instanceof Error ? error.message : PHONE_SIGNIN_FAILED_MESSAGE;
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (code: string): Promise<void> => {
    if (!confirmationRef.current) {
      throw new Error(OTP_MISSING_MESSAGE);
    }

    setIsLoading(true);
    try {
      await confirmationRef.current.confirm(code);
      confirmationRef.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : OTP_VERIFY_FAILED_MESSAGE;
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
      const token = await firebaseUser.getIdToken();
      const profile = await fetchUserProfile(token);
      setUser(profile);
    } catch {
      setUser(toAuthUserFromFirebase(firebaseUser));
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

  const value = useMemo<AuthContextValue>(
    (): AuthContextValue => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      signInWithGoogle,
      signInWithPhone,
      verifyOtp,
      signOut
    }),
    [user, isLoading, signInWithGoogle, signInWithPhone, verifyOtp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('AuthContext not available');
  }
  return context;
}
