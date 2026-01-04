import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { HTTPError } from 'ky';

import { ERROR_CODES, type ApiResponse, type User } from '@nyayamitra/shared';

import { apiClient } from '../services/api';
import { firebaseAuth } from '../services/firebase';

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
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
const INDIA_COUNTRY_CODE = '+91';
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
type ExpoExtra = {
  apiUrl?: string;
  firebaseWebClientId?: string;
};

const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
const GOOGLE_WEB_CLIENT_ID = extra?.firebaseWebClientId ?? '';

const GOOGLE_CONFIG_MISSING_MESSAGE = 'Google sign-in is not configured. Please try again later.';
const GOOGLE_SIGNIN_FAILED_MESSAGE = 'Unable to sign in with Google. Please try again.';
const GOOGLE_SIGNIN_CANCELLED_MESSAGE = 'Google sign-in was cancelled.';
const GOOGLE_SIGNIN_IN_PROGRESS_MESSAGE = 'Google sign-in is already in progress.';
const GOOGLE_PLAY_SERVICES_MESSAGE = 'Google Play Services is unavailable. Please try again.';
const PHONE_INVALID_MESSAGE = 'Please enter a valid phone number.';
const PHONE_SIGNIN_FAILED_MESSAGE = 'Unable to send OTP. Please try again.';
const TOO_MANY_REQUESTS_MESSAGE = 'Too many attempts. Please try again later.';
const OTP_INVALID_MESSAGE = 'Invalid OTP. Please try again.';
const OTP_EXPIRED_MESSAGE = 'OTP expired. Please request a new code.';
const OTP_MISSING_MESSAGE = 'Please request a new OTP.';
const OTP_VERIFY_FAILED_MESSAGE = 'Unable to verify OTP. Please try again.';
const PROFILE_LOAD_MESSAGE = 'Unable to load your profile. Please try again.';
const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';
const SIGN_OUT_MESSAGE = 'Unable to sign out. Please try again.';
const NETWORK_ERROR_MESSAGE = 'Network error. Please try again.';

const FRIENDLY_FALLBACK_MESSAGES = new Set<string>([
  GOOGLE_CONFIG_MISSING_MESSAGE,
  OTP_MISSING_MESSAGE,
  PROFILE_LOAD_MESSAGE,
  SESSION_EXPIRED_MESSAGE
]);

const AuthContext = createContext<AuthContextValue | null>(null);

function formatPhoneNumber(phoneNumber: string): string {
  const trimmed = phoneNumber.trim();
  if (trimmed.startsWith(INDIA_COUNTRY_CODE) || trimmed.startsWith('+')) {
    return trimmed;
  }
  return `${INDIA_COUNTRY_CODE}${trimmed}`;
}

function normalizeOptional(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  if (!('code' in error)) {
    return null;
  }
  const codeValue = (error as { code?: unknown }).code;
  return typeof codeValue === 'string' ? codeValue : null;
}

function getFallbackMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && FRIENDLY_FALLBACK_MESSAGES.has(error.message)) {
    return error.message;
  }
  return fallback;
}

function getAuthErrorMessage(error: unknown, fallback: string): string {
  const code = getErrorCode(error);
  switch (code) {
    case statusCodes.SIGN_IN_CANCELLED:
      return GOOGLE_SIGNIN_CANCELLED_MESSAGE;
    case statusCodes.IN_PROGRESS:
      return GOOGLE_SIGNIN_IN_PROGRESS_MESSAGE;
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return GOOGLE_PLAY_SERVICES_MESSAGE;
    case 'auth/invalid-phone-number':
      return PHONE_INVALID_MESSAGE;
    case 'auth/too-many-requests':
      return TOO_MANY_REQUESTS_MESSAGE;
    case 'auth/invalid-verification-code':
      return OTP_INVALID_MESSAGE;
    case 'auth/code-expired':
      return OTP_EXPIRED_MESSAGE;
    case 'auth/network-request-failed':
      return NETWORK_ERROR_MESSAGE;
    default:
      return getFallbackMessage(error, fallback);
  }
}

function toAuthUser(profile: UserProfileResponse): AuthUser {
  return {
    id: profile.uid,
    email: normalizeOptional(profile.email),
    phone: normalizeOptional(profile.phone)
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
  const confirmationRef = useRef<FirebaseAuthTypes.ConfirmationResult | null>(null);

  const loadProfile = useCallback(async (authUser: FirebaseAuthTypes.User): Promise<AuthUser> => {
    const token = await authUser.getIdToken();
    return fetchUserProfile(token);
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (!GOOGLE_WEB_CLIENT_ID) {
        throw new Error(GOOGLE_CONFIG_MISSING_MESSAGE);
      }

      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
      const signInResult = await GoogleSignin.signIn();
      if (signInResult.type !== 'success') {
        throw new Error(GOOGLE_SIGNIN_CANCELLED_MESSAGE);
      }

      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken;
      if (!idToken) {
        throw new Error(GOOGLE_SIGNIN_FAILED_MESSAGE);
      }

      const credential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await firebaseAuth.signInWithCredential(credential);
      const profile = await loadProfile(userCredential.user);
      setUser(profile);
    } catch (error) {
      const message = getAuthErrorMessage(error, GOOGLE_SIGNIN_FAILED_MESSAGE);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [loadProfile]);

  const signInWithPhone = useCallback(async (phoneNumber: string): Promise<void> => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      throw new Error(PHONE_INVALID_MESSAGE);
    }

    setIsLoading(true);
    try {
      const formatted = formatPhoneNumber(trimmed);
      const confirmation = await firebaseAuth.signInWithPhoneNumber(formatted);
      confirmationRef.current = confirmation;
    } catch (error) {
      const message = getAuthErrorMessage(error, PHONE_SIGNIN_FAILED_MESSAGE);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (code: string): Promise<void> => {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new Error(OTP_INVALID_MESSAGE);
    }

    setIsLoading(true);
    try {
      const confirmation = confirmationRef.current;
      if (!confirmation) {
        throw new Error(OTP_MISSING_MESSAGE);
      }

      const userCredential = await confirmation.confirm(trimmed);
      if (!userCredential) {
        throw new Error(OTP_VERIFY_FAILED_MESSAGE);
      }
      confirmationRef.current = null;
      const profile = await loadProfile(userCredential.user);
      setUser(profile);
    } catch (error) {
      const message = getAuthErrorMessage(error, OTP_VERIFY_FAILED_MESSAGE);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [loadProfile]);

  const signOut = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await firebaseAuth.signOut();
      confirmationRef.current = null;
      setUser(null);
    } catch (error) {
      const message = getAuthErrorMessage(error, SIGN_OUT_MESSAGE);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAuthStateChanged = useCallback(
    async (authUser: FirebaseAuthTypes.User | null): Promise<void> => {
      if (!authUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const profile = await loadProfile(authUser);
        setUser(profile);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    },
    [loadProfile]
  );

  useEffect((): (() => void) => {
    const unsubscribe = firebaseAuth.onAuthStateChanged((authUser): void => {
      void handleAuthStateChanged(authUser);
    });

    return unsubscribe;
  }, [handleAuthStateChanged]);

  const value = useMemo<AuthContextValue>((): AuthContextValue => {
    return {
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      signInWithGoogle,
      signInWithPhone,
      verifyOtp,
      signOut
    };
  }, [user, isLoading, signInWithGoogle, signInWithPhone, signOut, verifyOtp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('AuthContext not available');
  }
  return context;
}
