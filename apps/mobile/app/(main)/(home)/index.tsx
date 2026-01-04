import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  View
} from 'react-native';

import type { ApiResponse, Category, User } from '@nyayamitra/shared';

import { CategoryCard } from '../../../components/CategoryCard';
import { EmptyState } from '../../../components/EmptyState';
import { useAuth } from '../../../contexts/AuthContext';
import { apiClient } from '../../../services/api';
import { firebaseAuth } from '../../../services/firebase';

type UserProfileResponse = User & { draftsLimit: number };

const DATE_LOCALE = 'en-IN';
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

const EMPTY_COUNT = 0;
const PROGRESS_MAX = 1;
const PERCENT_MULTIPLIER = 100;
const SKELETON_CARD_COUNT = 4;
const CARD_WIDTH = '48%';
const HEADER_ICON_SIZE = 20;
const SEARCH_ICON_COLOR = '#0F172A';
const AVATAR_BACKGROUND = '#E2E8F0';
const PROGRESS_BACKGROUND = '#E2E8F0';
const PROGRESS_FOREGROUND = '#0F172A';
const USAGE_CARD_BACKGROUND = '#F8FAFC';
const SKELETON_BASE = '#E2E8F0';
const SKELETON_HIGHLIGHT = '#F1F5F9';

const GREETING_FALLBACK = 'there';
const UNLIMITED_LABEL = 'Unlimited';
const AUTH_REQUIRED_MESSAGE = 'Please sign in again.';
const ERROR_MESSAGE = 'Unable to load your dashboard.';
const RETRY_LABEL = 'Retry';

const LIST_CONTENT_STYLE = { paddingBottom: 24, paddingHorizontal: 24 } as const;
const GRID_COLUMN_STYLE = { justifyContent: 'space-between' } as const;
const GRID_ITEM_STYLE = { width: CARD_WIDTH } as const;

async function getAuthToken(): Promise<string> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }
  return currentUser.getIdToken();
}

async function fetchCategories(): Promise<Category[]> {
  const token = await getAuthToken();
  const response = await apiClient
    .get('categories', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<ApiResponse<Category[]>>();

  return response.data;
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

function getFirstName(name: string | undefined): string {
  if (!name) {
    return GREETING_FALLBACK;
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return GREETING_FALLBACK;
  }
  const [first] = trimmed.split(/\s+/);
  return first || GREETING_FALLBACK;
}

function getAvatarLetter(name: string | undefined): string {
  if (!name) {
    return GREETING_FALLBACK.slice(0, 1).toUpperCase();
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return GREETING_FALLBACK.slice(0, 1).toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}

function formatDate(value: Date): string {
  return value.toLocaleDateString(DATE_LOCALE, DATE_OPTIONS);
}

function DashboardSkeleton(): JSX.Element {
  return (
    <SafeAreaView className='flex-1 bg-white'>
      <View className='flex-1 px-6'>
        <View className='mt-4 flex-row items-center justify-between'>
          <View className='h-10 w-10 rounded-xl' style={{ backgroundColor: SKELETON_BASE }} />
          <View className='flex-row items-center'>
            <View
              className='mr-4 h-6 w-6 rounded-full'
              style={{ backgroundColor: SKELETON_BASE }}
            />
            <View className='h-10 w-10 rounded-full' style={{ backgroundColor: SKELETON_BASE }} />
          </View>
        </View>

        <View className='mt-6'>
          <View className='h-7 w-40 rounded-lg' style={{ backgroundColor: SKELETON_BASE }} />
          <View className='mt-2 h-4 w-24 rounded-lg' style={{ backgroundColor: SKELETON_HIGHLIGHT }} />
        </View>

        <View className='mt-6 rounded-2xl p-4' style={{ backgroundColor: SKELETON_HIGHLIGHT }}>
          <View className='h-4 w-52 rounded-lg' style={{ backgroundColor: SKELETON_BASE }} />
          <View className='mt-3 h-2 w-full rounded-full' style={{ backgroundColor: SKELETON_BASE }} />
        </View>

        <View className='mt-8 flex-row flex-wrap justify-between'>
          {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
            <View
              key={`skeleton-card-${index}`}
              className='mb-4 h-28 rounded-2xl'
              style={[GRID_ITEM_STYLE, { backgroundColor: SKELETON_HIGHLIGHT }]}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
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
          style={{ backgroundColor: PROGRESS_FOREGROUND }}
        >
          <Text className='text-sm font-semibold text-white'>{RETRY_LABEL}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function DashboardScreen(): JSX.Element {
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const categoriesQuery = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: fetchCategories,
    enabled: Boolean(user)
  });

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: fetchProfile,
    enabled: Boolean(user)
  });

  const isInitialLoading = !user || categoriesQuery.isLoading || profileQuery.isLoading;
  const isRetrying = isRefreshing || categoriesQuery.isFetching || profileQuery.isFetching;
  const hasError = Boolean(categoriesQuery.error) || Boolean(profileQuery.error);
  let errorMessage = ERROR_MESSAGE;
  if (categoriesQuery.error instanceof Error) {
    errorMessage = categoriesQuery.error.message;
  } else if (profileQuery.error instanceof Error) {
    errorMessage = profileQuery.error.message;
  }

  const profile = profileQuery.data;
  const categories = categoriesQuery.data ?? [];
  const greetingName = useMemo(
    (): string => getFirstName(profile?.displayName || profile?.email || user?.email),
    [profile?.displayName, profile?.email, user?.email]
  );
  const avatarLetter = useMemo(
    (): string => getAvatarLetter(profile?.displayName || profile?.email || user?.email),
    [profile?.displayName, profile?.email, user?.email]
  );
  const dateLabel = useMemo((): string => formatDate(new Date()), []);

  const draftsUsed = profile?.draftsUsedThisMonth ?? EMPTY_COUNT;
  const draftsLimit = profile?.draftsLimit ?? EMPTY_COUNT;
  const hasFiniteLimit = Number.isFinite(draftsLimit) && draftsLimit > EMPTY_COUNT;
  const limitLabel = hasFiniteLimit ? `${draftsLimit}` : UNLIMITED_LABEL;
  const progressRatio = hasFiniteLimit
    ? Math.min(draftsUsed / draftsLimit, PROGRESS_MAX)
    : EMPTY_COUNT;
  const progressWidth = `${progressRatio * PERCENT_MULTIPLIER}%` as `${number}%`;

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await Promise.all([categoriesQuery.refetch(), profileQuery.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [categoriesQuery, profileQuery]);

  const handleCategoryPress = useCallback((id: string): void => {
    router.push({ pathname: '/category/[id]', params: { id } });
  }, []);

  const handleProfilePress = useCallback((): void => {
    router.push('/profile');
  }, []);

  const renderCategoryItem = useCallback(
    ({ item }: { item: Category }): JSX.Element => {
      return (
        <View className='mb-4' style={GRID_ITEM_STYLE}>
          <CategoryCard
            icon={item.icon}
            name={item.name}
            onPress={(): void => handleCategoryPress(item.id)}
            templateCount={item.templateCount}
          />
        </View>
      );
    },
    [handleCategoryPress]
  );

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  if (hasError) {
    return <ErrorState isRetrying={isRetrying} message={errorMessage} onRetry={handleRefresh} />;
  }

  return (
    <SafeAreaView className='flex-1 bg-white'>
      <FlatList
        contentContainerStyle={LIST_CONTENT_STYLE}
        data={categories}
        keyExtractor={(item): string => item.id}
        numColumns={2}
        renderItem={renderCategoryItem}
        columnWrapperStyle={GRID_COLUMN_STYLE}
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={isRefreshing} />}
        ListHeaderComponent={
          <View>
            <View className='mt-4 flex-row items-center justify-between'>
              <View className='h-10 w-10 items-center justify-center rounded-xl bg-slate-900'>
                <Text className='text-sm font-semibold text-white'>NM</Text>
              </View>
              <View className='flex-row items-center'>
                <View className='mr-4 h-9 w-9 items-center justify-center rounded-full bg-slate-100'>
                  <Ionicons name='search-outline' size={HEADER_ICON_SIZE} color={SEARCH_ICON_COLOR} />
                </View>
                <Pressable onPress={handleProfilePress}>
                  <View
                    className='h-10 w-10 items-center justify-center rounded-full'
                    style={{ backgroundColor: AVATAR_BACKGROUND }}
                  >
                    <Text className='text-sm font-semibold text-slate-700'>{avatarLetter}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <View className='mt-6'>
              <Text className='text-2xl font-semibold text-slate-900'>Hello, {greetingName}</Text>
              <Text className='mt-1 text-sm text-slate-500'>{dateLabel}</Text>
            </View>

            <View className='mt-6 rounded-2xl p-4' style={{ backgroundColor: USAGE_CARD_BACKGROUND }}>
              <Text className='text-sm font-semibold text-slate-900'>
                {draftsUsed} of {limitLabel} drafts used this month
              </Text>
              <View className='mt-3 h-2 w-full overflow-hidden rounded-full' style={{ backgroundColor: PROGRESS_BACKGROUND }}>
                <View className='h-2 rounded-full' style={{ backgroundColor: PROGRESS_FOREGROUND, width: progressWidth }} />
              </View>
            </View>

            <Text className='mt-8 text-base font-semibold text-slate-900'>Categories</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState message='No categories available' />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
