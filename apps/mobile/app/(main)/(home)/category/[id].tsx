import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  TextInput,
  View
} from 'react-native';

import type { PaginatedResponse, Template } from '@nyayamitra/shared';

import { EmptyState } from '../../../../components/EmptyState';
import { LoadingSpinner } from '../../../../components/LoadingSpinner';
import { TemplateCard } from '../../../../components/TemplateCard';
import { useAuth } from '../../../../contexts/AuthContext';
import { apiClient } from '../../../../services/api';
import { firebaseAuth } from '../../../../services/firebase';

type TemplateSummary = Omit<Template, 'variables' | 'templateFileURL'>;

const PAGE_START = 1;
const PAGE_LIMIT = 20;
const DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 1;
const ON_END_THRESHOLD = 0.4;
const HEADER_ICON_SIZE = 20;
const SEARCH_ICON_COLOR = '#0F172A';
const HEADER_TEXT_COLOR = '#0F172A';
const SEARCH_INPUT_BACKGROUND = '#F1F5F9';
const SEARCH_INPUT_TEXT = '#0F172A';
const SEARCH_INPUT_PLACEHOLDER = '#94A3B8';

const AUTH_REQUIRED_MESSAGE = 'Please sign in again.';
const DEFAULT_CATEGORY_LABEL = 'Category';
const SEARCH_PLACEHOLDER = 'Search templates';
const EMPTY_MESSAGE = 'No templates found';
const ERROR_MESSAGE = 'Unable to load templates.';
const RETRY_LABEL = 'Retry';

const LIST_CONTENT_STYLE = { paddingBottom: 24, paddingHorizontal: 24 } as const;

async function getAuthToken(): Promise<string> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }
  return currentUser.getIdToken();
}

async function fetchTemplates(params: {
  categoryId: string;
  page: number;
  search: string;
}): Promise<PaginatedResponse<TemplateSummary>> {
  const token = await getAuthToken();
  const searchParams: Record<string, string> = {
    categoryId: params.categoryId,
    page: `${params.page}`,
    limit: `${PAGE_LIMIT}`
  };

  if (params.search.trim().length >= MIN_SEARCH_LENGTH) {
    searchParams.search = params.search.trim();
  }

  return apiClient
    .get('templates', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      searchParams
    })
    .json<PaginatedResponse<TemplateSummary>>();
}

function getCategoryName(templates: TemplateSummary[], fallback: string): string {
  if (templates.length > 0 && templates[0].categoryName) {
    return templates[0].categoryName;
  }
  return fallback;
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

export function CategoryScreen(): JSX.Element {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const categoryId = typeof id === 'string' ? id : '';
  const [searchValue, setSearchValue] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const templatesQuery = useInfiniteQuery({
    queryKey: ['templates', categoryId, debouncedSearch],
    queryFn: ({ pageParam = PAGE_START }) =>
      fetchTemplates({ categoryId, page: pageParam, search: debouncedSearch }),
    initialPageParam: PAGE_START,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    enabled: Boolean(categoryId && user)
  });

  const templates = useMemo(
    (): TemplateSummary[] => templatesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [templatesQuery.data]
  );

  const fallbackCategoryName = categoryId || DEFAULT_CATEGORY_LABEL;
  const categoryName = useMemo(
    (): string => getCategoryName(templates, fallbackCategoryName),
    [fallbackCategoryName, templates]
  );

  const isInitialLoading = !user || templatesQuery.isLoading;
  const isFetchingMore = templatesQuery.isFetchingNextPage;
  const isRetrying = isRefreshing || templatesQuery.isFetching;
  const hasError = Boolean(templatesQuery.error);
  const errorMessage =
    templatesQuery.error instanceof Error ? templatesQuery.error.message : ERROR_MESSAGE;

  const handleSearchToggle = useCallback((): void => {
    setIsSearchVisible((current) => {
      const next = !current;
      if (!next) {
        setSearchValue('');
        setDebouncedSearch('');
      }
      return next;
    });
  }, []);

  const handleSearchChange = useCallback((value: string): void => {
    setSearchValue(value);
  }, []);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await templatesQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [templatesQuery]);

  const handleEndReached = useCallback((): void => {
    if (templatesQuery.hasNextPage && !templatesQuery.isFetchingNextPage) {
      void templatesQuery.fetchNextPage();
    }
  }, [templatesQuery]);

  const handleTemplatePress = useCallback((templateId: string): void => {
    router.push({ pathname: '/template/[id]', params: { id: templateId } });
  }, []);

  const handleBack = useCallback((): void => {
    router.back();
  }, []);

  useEffect((): (() => void) => {
    const timeoutId = setTimeout((): void => {
      setDebouncedSearch(searchValue.trim());
    }, DEBOUNCE_MS);

    return (): void => {
      clearTimeout(timeoutId);
    };
  }, [searchValue]);

  if (!categoryId) {
    return <ErrorState isRetrying={false} message={ERROR_MESSAGE} onRetry={handleBack} />;
  }

  if (isInitialLoading) {
    return <LoadingState />;
  }

  if (hasError) {
    return <ErrorState isRetrying={isRetrying} message={errorMessage} onRetry={handleRefresh} />;
  }

  return (
    <SafeAreaView className='flex-1 bg-white'>
      <FlatList
        contentContainerStyle={LIST_CONTENT_STYLE}
        data={templates}
        keyExtractor={(item): string => item.id}
        onEndReached={handleEndReached}
        onEndReachedThreshold={ON_END_THRESHOLD}
        renderItem={({ item }): JSX.Element => (
          <View className='mb-4'>
            <TemplateCard
              description={item.description}
              estimatedMinutes={item.estimatedMinutes}
              name={item.name}
              onPress={(): void => handleTemplatePress(item.id)}
            />
          </View>
        )}
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={isRefreshing} />}
        ListHeaderComponent={
          <View>
            <View className='mt-4 flex-row items-center justify-between'>
              <Pressable className='h-10 w-10 items-center justify-center rounded-full bg-slate-100' onPress={handleBack}>
                <Ionicons name='chevron-back' size={HEADER_ICON_SIZE} color={HEADER_TEXT_COLOR} />
              </Pressable>
              <Text className='text-base font-semibold text-slate-900'>{categoryName}</Text>
              <Pressable
                className='h-10 w-10 items-center justify-center rounded-full bg-slate-100'
                onPress={handleSearchToggle}
              >
                <Ionicons name='search-outline' size={HEADER_ICON_SIZE} color={SEARCH_ICON_COLOR} />
              </Pressable>
            </View>

            {isSearchVisible ? (
              <View
                className='mt-4 flex-row items-center rounded-xl px-4 py-3'
                style={{ backgroundColor: SEARCH_INPUT_BACKGROUND }}
              >
                <Ionicons name='search-outline' size={HEADER_ICON_SIZE} color={SEARCH_ICON_COLOR} />
                <TextInput
                  autoFocus
                  className='ml-3 flex-1 text-sm text-slate-900'
                  onChangeText={handleSearchChange}
                  placeholder={SEARCH_PLACEHOLDER}
                  placeholderTextColor={SEARCH_INPUT_PLACEHOLDER}
                  selectionColor={SEARCH_INPUT_TEXT}
                  value={searchValue}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={<EmptyState message={EMPTY_MESSAGE} />}
        ListFooterComponent={
          isFetchingMore ? (
            <View className='items-center py-4'>
              <LoadingSpinner />
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
