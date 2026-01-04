import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';

import type { ApiResponse, User, UserPlan } from '@nyayamitra/shared';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/api';
import { firebaseAuth } from '../../services/firebase';

type UserProfileResponse = User & { draftsLimit: number };

const AUTH_REQUIRED_MESSAGE = 'Please sign in again.';
const PROFILE_ERROR_MESSAGE = 'Unable to load your profile.';
const UPDATE_ERROR_MESSAGE = 'Unable to update your name.';
const SIGN_OUT_ERROR_MESSAGE = 'Unable to sign out.';

const HEADER_TITLE = 'Profile';
const NAME_PLACEHOLDER = 'Your name';
const CONTACT_FALLBACK = 'No contact info';
const PLAN_PREFIX = 'Current Plan';
const DRAFTS_PREFIX = 'Drafts this month:';
const UPGRADE_LABEL = 'Upgrade Plan';
const SIGN_OUT_LABEL = 'Sign Out';
const EDIT_TITLE = 'Edit name';
const SAVE_LABEL = 'Save';
const CANCEL_LABEL = 'Cancel';
const NAME_REQUIRED_MESSAGE = 'Name cannot be empty.';
const SIGN_OUT_TITLE = 'Sign out?';
const SIGN_OUT_MESSAGE = 'You will need to sign in again.';
const VERSION_LABEL = 'Version';
const DEFAULT_NAME = 'User';
const UNLIMITED_LABEL = 'Unlimited';
const RETRY_LABEL = 'Retry';

const PRIMARY_BUTTON_COLOR = '#0F172A';
const PRIMARY_TEXT_COLOR = '#FFFFFF';
const DISABLED_BUTTON_COLOR = '#94A3B8';
const SIGN_OUT_BUTTON_COLOR = '#EF4444';
const AVATAR_BACKGROUND = '#E2E8F0';
const AVATAR_TEXT_COLOR = '#0F172A';
const MODAL_OVERLAY = 'rgba(15, 23, 42, 0.45)';
const INPUT_BACKGROUND = '#F8FAFC';
const PLACEHOLDER_TEXT_COLOR = '#94A3B8';

const PLAN_BADGE = {
  free: { background: '#E2E8F0', text: '#0F172A' },
  pro: { background: '#DCFCE7', text: '#166534' },
  unlimited: { background: '#DBEAFE', text: '#1D4ED8' }
} as const;

const EMPTY_COUNT = 0;
const INITIALS_MAX = 2;

const CONTENT_STYLE = { paddingBottom: 32, paddingHorizontal: 24 } as const;
const MODAL_CARD_STYLE = { backgroundColor: '#FFFFFF' } as const;

async function getAuthToken(): Promise<string> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }
  return currentUser.getIdToken();
}

async function fetchProfile(): Promise<UserProfileResponse> {
  const token = await getAuthToken();
  const response = await apiClient
    .get('user/profile', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<ApiResponse<UserProfileResponse>>();

  return response.data;
}

async function updateProfile(displayName: string): Promise<User> {
  const token = await getAuthToken();
  const response = await apiClient
    .patch('user/profile', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      json: {
        displayName
      }
    })
    .json<ApiResponse<User>>();

  return response.data;
}

function getDisplayName(profile: UserProfileResponse | undefined, fallback: string): string {
  if (!profile) {
    return fallback;
  }
  const trimmedName = profile.displayName.trim();
  if (trimmedName) {
    return trimmedName;
  }
  const trimmedEmail = profile.email.trim();
  if (trimmedEmail) {
    return trimmedEmail;
  }
  const trimmedPhone = profile.phone.trim();
  if (trimmedPhone) {
    return trimmedPhone;
  }
  return fallback;
}

function getContactLabel(profile: UserProfileResponse | undefined): string {
  if (!profile) {
    return CONTACT_FALLBACK;
  }
  const email = profile.email.trim();
  if (email) {
    return email;
  }
  const phone = profile.phone.trim();
  if (phone) {
    return phone;
  }
  return CONTACT_FALLBACK;
}

function getInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_NAME.slice(0, 1);
  }
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  const initials = `${first}${second}`.toUpperCase();
  if (initials.length > 0) {
    return initials.slice(0, INITIALS_MAX);
  }
  return trimmed.slice(0, INITIALS_MAX).toUpperCase();
}

function getPlanLabel(plan: UserPlan | undefined): string {
  switch (plan) {
    case 'pro':
      return 'Pro';
    case 'unlimited':
      return 'Unlimited';
    case 'free':
    default:
      return 'Free';
  }
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}

function LoadingState(): JSX.Element {
  return (
    <SafeAreaView className='flex-1 items-center justify-center bg-white'>
      <LoadingSpinner />
    </SafeAreaView>
  );
}

function ErrorState({ message, onRetry, isRetrying }: ErrorStateProps): JSX.Element {
  return (
    <SafeAreaView className='flex-1 bg-white'>
      <View className='flex-1 items-center justify-center px-6'>
        <Text className='text-center text-sm text-slate-600'>{message}</Text>
        <Pressable
          className={`mt-4 rounded-full px-4 py-2 ${isRetrying ? 'opacity-60' : ''}`}
          disabled={isRetrying}
          onPress={onRetry}
        >
          <Text className='text-sm font-semibold text-slate-900'>{RETRY_LABEL}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function ProfileScreen(): JSX.Element {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [nameDraft, setNameDraft] = useState<string>('');
  const [nameError, setNameError] = useState<string>('');
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  const profileQueryKey = ['profile', user?.id] as const;

  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
    enabled: Boolean(user)
  });

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated: User): void => {
      queryClient.setQueryData<UserProfileResponse>(profileQueryKey, (current) => {
        if (!current) {
          return current;
        }
        return { ...current, displayName: updated.displayName };
      });
      setIsEditing(false);
    }
  });

  const profile = profileQuery.data;
  const displayName = useMemo(
    (): string => getDisplayName(profile, user?.email ?? user?.phone ?? DEFAULT_NAME),
    [profile, user?.email, user?.phone]
  );
  const contactLabel = useMemo((): string => getContactLabel(profile), [profile]);
  const initials = useMemo((): string => getInitials(displayName), [displayName]);
  const appVersion = Constants.expoConfig?.version ?? '-';
  const photoUrl = firebaseAuth.currentUser?.photoURL ?? '';

  const draftsLimit = profile?.draftsLimit ?? EMPTY_COUNT;
  const draftsUsed = profile?.draftsUsedThisMonth ?? EMPTY_COUNT;
  const hasFiniteLimit = Number.isFinite(draftsLimit) && draftsLimit > EMPTY_COUNT;
  const limitLabel = hasFiniteLimit ? `${draftsLimit}` : UNLIMITED_LABEL;
  const planLabel = getPlanLabel(profile?.plan);
  const planBadge = PLAN_BADGE[profile?.plan ?? 'free'];
  const showUpgrade = profile?.plan === 'free';

  const isInitialLoading = !user || profileQuery.isLoading;
  const isRetrying = profileQuery.isFetching;
  const hasError = Boolean(profileQuery.error);
  const errorMessage = profileQuery.error instanceof Error ? profileQuery.error.message : PROFILE_ERROR_MESSAGE;

  const handleOpenEdit = useCallback((): void => {
    if (!profile) {
      return;
    }
    setNameDraft(profile.displayName);
    setNameError('');
    setIsEditing(true);
  }, [profile]);

  const handleCloseEdit = useCallback((): void => {
    if (updateMutation.isPending) {
      return;
    }
    setIsEditing(false);
    setNameError('');
  }, [updateMutation.isPending]);

  const handleNameChange = useCallback((value: string): void => {
    setNameDraft(value);
  }, []);

  const handleSaveName = useCallback(async (): Promise<void> => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError(NAME_REQUIRED_MESSAGE);
      return;
    }
    setNameError('');
    try {
      await updateMutation.mutateAsync(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : UPDATE_ERROR_MESSAGE;
      setNameError(message);
    }
  }, [nameDraft, updateMutation]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : SIGN_OUT_ERROR_MESSAGE;
      Alert.alert(SIGN_OUT_ERROR_MESSAGE, message);
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, signOut]);

  const handleSignOutPress = useCallback((): void => {
    Alert.alert(SIGN_OUT_TITLE, SIGN_OUT_MESSAGE, [
      { text: CANCEL_LABEL, style: 'cancel' },
      {
        text: SIGN_OUT_LABEL,
        style: 'destructive',
        onPress: (): void => {
          void handleSignOut();
        }
      }
    ]);
  }, [handleSignOut]);

  if (isInitialLoading) {
    return <LoadingState />;
  }

  if (hasError) {
    return <ErrorState isRetrying={isRetrying} message={errorMessage} onRetry={profileQuery.refetch} />;
  }

  const isSaveDisabled = updateMutation.isPending || nameDraft.trim().length === 0;
  const isSignOutDisabled = isSigningOut || updateMutation.isPending;

  return (
    <SafeAreaView className='flex-1 bg-white'>
      <ScrollView
        className='flex-1'
        contentContainerStyle={{ ...CONTENT_STYLE, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className='text-xl font-semibold text-slate-900'>{HEADER_TITLE}</Text>

        <View className='mt-6 items-center'>
          {photoUrl ? (
            <Image className='h-20 w-20 rounded-full' source={{ uri: photoUrl }} />
          ) : (
            <View className='h-20 w-20 items-center justify-center rounded-full' style={{ backgroundColor: AVATAR_BACKGROUND }}>
              <Text className='text-lg font-semibold' style={{ color: AVATAR_TEXT_COLOR }}>
                {initials}
              </Text>
            </View>
          )}
          <Pressable className='mt-4' onPress={handleOpenEdit}>
            <Text className='text-lg font-semibold text-slate-900'>{displayName}</Text>
          </Pressable>
          <Text className='mt-1 text-sm text-slate-500'>{contactLabel}</Text>
        </View>

        <View className='my-6 h-px bg-slate-200' />

        <View className='flex-row items-center justify-between'>
          <Text className='text-sm text-slate-600'>{PLAN_PREFIX}:</Text>
          <View className='rounded-full px-3 py-1' style={{ backgroundColor: planBadge.background }}>
            <Text className='text-xs font-semibold' style={{ color: planBadge.text }}>
              {planLabel}
            </Text>
          </View>
        </View>

        <Text className='mt-3 text-sm text-slate-600'>
          {DRAFTS_PREFIX} {draftsUsed} / {limitLabel}
        </Text>

        {showUpgrade ? (
          <Pressable
            className='mt-5 w-full rounded-xl py-3 items-center'
            style={{ backgroundColor: PRIMARY_BUTTON_COLOR }}
          >
            <Text className='text-base font-semibold' style={{ color: PRIMARY_TEXT_COLOR }}>
              {UPGRADE_LABEL}
            </Text>
          </Pressable>
        ) : null}

        <View className='my-6 h-px bg-slate-200' />

        <Pressable
          className={`w-full rounded-xl py-3 items-center ${isSignOutDisabled ? 'opacity-60' : ''}`}
          disabled={isSignOutDisabled}
          onPress={handleSignOutPress}
          style={{ backgroundColor: SIGN_OUT_BUTTON_COLOR }}
        >
          <Text className='text-base font-semibold text-white'>{SIGN_OUT_LABEL}</Text>
        </Pressable>

        <View className='mt-auto items-center pt-8'>
          <Text className='text-xs text-slate-400'>
            {VERSION_LABEL} {appVersion}
          </Text>
        </View>
      </ScrollView>

      <Modal animationType='fade' transparent visible={isEditing} onRequestClose={handleCloseEdit}>
        <View className='flex-1 items-center justify-center px-6' style={{ backgroundColor: MODAL_OVERLAY }}>
          <View className='w-full rounded-2xl p-5' style={MODAL_CARD_STYLE}>
            <Text className='text-base font-semibold text-slate-900'>{EDIT_TITLE}</Text>
            <TextInput
              autoFocus
              className='mt-4 rounded-xl px-4 py-3 text-base text-slate-900'
              onChangeText={handleNameChange}
              placeholder={NAME_PLACEHOLDER}
              placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
              value={nameDraft}
              style={{ backgroundColor: INPUT_BACKGROUND }}
            />
            {nameError ? <Text className='mt-2 text-xs text-red-600'>{nameError}</Text> : null}
            <View className='mt-5 flex-row justify-end'>
              <Pressable className='mr-3 px-3 py-2' disabled={updateMutation.isPending} onPress={handleCloseEdit}>
                <Text className='text-sm font-semibold text-slate-600'>{CANCEL_LABEL}</Text>
              </Pressable>
              <Pressable
                className='rounded-lg px-4 py-2'
                disabled={isSaveDisabled}
                onPress={handleSaveName}
                style={{ backgroundColor: isSaveDisabled ? DISABLED_BUTTON_COLOR : PRIMARY_BUTTON_COLOR }}
              >
                <Text className='text-sm font-semibold text-white'>{SAVE_LABEL}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
