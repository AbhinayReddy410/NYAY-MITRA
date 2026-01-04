'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { ApiResponse, User, UserPlan } from '@nyayamitra/shared';

import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../../contexts/AuthContext';
import { apiClient } from '../../../lib/api';

type UserProfileResponse = User & { draftsLimit: number };

const AUTH_REQUIRED_MESSAGE = 'Please sign in again.';
const PROFILE_ERROR_MESSAGE = 'Unable to load your profile.';
const UPDATE_ERROR_MESSAGE = 'Unable to update your name.';
const SIGN_OUT_ERROR_MESSAGE = 'Unable to sign out.';

const HEADER_TITLE = 'Profile';
const NAME_LABEL = 'Name';
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
const DEFAULT_NAME = 'User';
const UNLIMITED_LABEL = 'Unlimited';
const RETRY_LABEL = 'Retry';
const LOADING_MESSAGE = 'Loading...';

const PLAN_BADGE = {
  free: { background: 'bg-slate-100', text: 'text-slate-900' },
  pro: { background: 'bg-green-100', text: 'text-green-800' },
  unlimited: { background: 'bg-blue-100', text: 'text-blue-800' }
} as const;

const EMPTY_COUNT = 0;
const INITIALS_MAX = 2;

async function fetchProfile(token: string): Promise<UserProfileResponse> {
  const response = await apiClient
    .get('user/profile', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<ApiResponse<UserProfileResponse>>();

  return response.data;
}

async function updateProfile(displayName: string, token: string): Promise<User> {
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

function getDisplayName(profile: User | UserProfileResponse | undefined, fallback: string): string {
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

function getContactLabel(profile: User | UserProfileResponse | undefined): string {
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

export default function ProfilePage(): JSX.Element {
  const { profile: authProfile, firebaseUser, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [nameDraft, setNameDraft] = useState<string>('');
  const [nameError, setNameError] = useState<string>('');

  const profileQueryKey = ['profile', firebaseUser?.uid] as const;

  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: async (): Promise<UserProfileResponse> => {
      if (!firebaseUser) {
        throw new Error(AUTH_REQUIRED_MESSAGE);
      }
      const token = await fetch('/api/auth/token').then((res) => res.text());
      return fetchProfile(token);
    },
    enabled: Boolean(firebaseUser)
  });

  const updateMutation = useMutation({
    mutationFn: async (displayName: string): Promise<User> => {
      if (!firebaseUser) {
        throw new Error(AUTH_REQUIRED_MESSAGE);
      }
      const token = await fetch('/api/auth/token').then((res) => res.text());
      return updateProfile(displayName, token);
    },
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

  const profileData = profileQuery.data ?? authProfile ?? null;
  const displayName = useMemo(
    (): string => getDisplayName(profileData ?? undefined, profileData?.email ?? profileData?.phone ?? DEFAULT_NAME),
    [profileData]
  );
  const contactLabel = useMemo((): string => getContactLabel(profileData ?? undefined), [profileData]);
  const initials = useMemo((): string => getInitials(displayName), [displayName]);
  const photoUrl = firebaseUser?.photoURL ?? '';

  const draftsLimit: number = (profileData && 'draftsLimit' in profileData && typeof profileData.draftsLimit === 'number')
    ? profileData.draftsLimit
    : EMPTY_COUNT;
  const draftsUsed = profileData?.draftsUsedThisMonth ?? EMPTY_COUNT;
  const hasFiniteLimit = Number.isFinite(draftsLimit) && draftsLimit > EMPTY_COUNT;
  const limitLabel = hasFiniteLimit ? `${draftsLimit}` : UNLIMITED_LABEL;
  const planLabel = getPlanLabel(profileData?.plan);
  const planBadge = PLAN_BADGE[profileData?.plan ?? 'free'];
  const showUpgrade = profileData?.plan === 'free';

  const isInitialLoading = !firebaseUser || profileQuery.isLoading;
  const hasError = Boolean(profileQuery.error);
  const errorMessage = profileQuery.error instanceof Error ? profileQuery.error.message : PROFILE_ERROR_MESSAGE;

  const handleOpenEdit = useCallback((): void => {
    if (!profileData) {
      return;
    }
    setNameDraft(profileData.displayName);
    setNameError('');
    setIsEditing(true);
  }, [profileData]);

  const handleCloseEdit = useCallback((): void => {
    if (updateMutation.isPending) {
      return;
    }
    setIsEditing(false);
    setNameError('');
  }, [updateMutation.isPending]);

  const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setNameDraft(event.target.value);
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
    try {
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : SIGN_OUT_ERROR_MESSAGE;
      alert(message);
    }
  }, [signOut]);

  const handleRetry = useCallback((): void => {
    void profileQuery.refetch();
  }, [profileQuery]);

  if (isInitialLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <p className='text-slate-500'>{LOADING_MESSAGE}</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <Card>
        <p className='text-sm text-red-600'>{errorMessage}</p>
        <button
          className='mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800'
          onClick={handleRetry}
          type='button'
        >
          {RETRY_LABEL}
        </button>
      </Card>
    );
  }

  const isSaveDisabled = updateMutation.isPending || nameDraft.trim().length === 0;

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-semibold text-slate-900'>{HEADER_TITLE}</h1>
      </div>

      <Card>
        {/* Profile Header */}
        <div className='flex flex-col items-center text-center'>
          {photoUrl ? (
            <img alt={displayName} className='h-20 w-20 rounded-full' src={photoUrl} />
          ) : (
            <div className='flex h-20 w-20 items-center justify-center rounded-full bg-slate-200'>
              <span className='text-lg font-semibold text-slate-900'>{initials}</span>
            </div>
          )}
          <button
            className='mt-4 text-lg font-semibold text-slate-900 hover:text-slate-700'
            onClick={handleOpenEdit}
            type='button'
          >
            {displayName}
          </button>
          <p className='mt-1 text-sm text-slate-500'>{contactLabel}</p>
        </div>

        <div className='my-6 h-px bg-slate-200' />

        {/* Plan Info */}
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-slate-600'>{PLAN_PREFIX}:</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${planBadge.background} ${planBadge.text}`}>
              {planLabel}
            </span>
          </div>

          <p className='text-sm text-slate-600'>
            {DRAFTS_PREFIX} {draftsUsed} / {limitLabel}
          </p>

          {showUpgrade ? (
            <Button className='w-full mt-4' type='button'>
              {UPGRADE_LABEL}
            </Button>
          ) : null}
        </div>

        <div className='my-6 h-px bg-slate-200' />

        {/* Sign Out */}
        <Button
          className='w-full bg-red-500 hover:bg-red-600'
          onClick={handleSignOut}
          type='button'
        >
          {SIGN_OUT_LABEL}
        </Button>
      </Card>

      {/* Edit Name Modal */}
      {isEditing ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40'>
          <div className='w-full max-w-md rounded-2xl bg-white p-6 mx-4'>
            <h2 className='text-base font-semibold text-slate-900'>{EDIT_TITLE}</h2>
            <div className='mt-4'>
              <label className='text-sm font-medium text-slate-900'>{NAME_LABEL}</label>
              <Input
                autoFocus
                className='mt-2'
                onChange={handleNameChange}
                placeholder={NAME_PLACEHOLDER}
                type='text'
                value={nameDraft}
              />
              {nameError ? <p className='mt-2 text-xs text-red-600'>{nameError}</p> : null}
            </div>
            <div className='mt-5 flex justify-end gap-2'>
              <button
                className='px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800'
                disabled={updateMutation.isPending}
                onClick={handleCloseEdit}
                type='button'
              >
                {CANCEL_LABEL}
              </button>
              <button
                className='rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60'
                disabled={isSaveDisabled}
                onClick={handleSaveName}
                type='button'
              >
                {SAVE_LABEL}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
