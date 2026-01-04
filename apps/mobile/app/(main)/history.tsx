import { useInfiniteQuery, type InfiniteData, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  View
} from 'react-native';

import type { Draft, PaginatedResponse } from '@nyayamitra/shared';

import { DraftHistoryItem } from '../../components/DraftHistoryItem';
import { EmptyState } from '../../components/EmptyState';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/api';
import { firebaseAuth } from '../../services/firebase';

type DraftSummary = Omit<Draft, 'variables'>;

const PAGE_START = 1;
const PAGE_LIMIT = 20;
const ON_END_THRESHOLD = 0.4;

const HEADER_TITLE = 'My Drafts';
const EMPTY_MESSAGE = 'No drafts yet';
const ERROR_MESSAGE = 'Unable to load drafts.';
const RETRY_LABEL = 'Retry';
const AUTH_REQUIRED_MESSAGE = 'Please sign in again.';

const DOWNLOAD_ERROR_TITLE = 'Download failed';
const DOWNLOAD_ERROR_MESSAGE = 'Unable to download draft.';
const DOWNLOAD_LINK_MISSING_MESSAGE = 'Download link unavailable.';
const STORAGE_ERROR_MESSAGE = 'Unable to access storage.';
const SHARE_UNAVAILABLE_MESSAGE = 'Sharing is not available on this device.';

const DELETE_CONFIRM_TITLE = 'Delete draft?';
const DELETE_CONFIRM_MESSAGE = 'This will remove the draft from your history.';
const DELETE_ERROR_TITLE = 'Delete failed';
const DELETE_ERROR_MESSAGE = 'Unable to delete draft.';
const DELETE_LABEL = 'Delete';
const CANCEL_LABEL = 'Cancel';

const DRAFT_FILE_PREFIX = 'draft-';
const DRAFT_FILE_EXTENSION = '.docx';

const LIST_CONTENT_STYLE = { paddingBottom: 24, paddingHorizontal: 24 } as const;

async function getAuthToken(): Promise<string> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }
  return currentUser.getIdToken();
}

async function fetchDraftHistory(page: number): Promise<PaginatedResponse<DraftSummary>> {
  const token = await getAuthToken();
  return apiClient
    .get('drafts/history', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      searchParams: {
        page: `${page}`,
        limit: `${PAGE_LIMIT}`
      }
    })
    .json<PaginatedResponse<DraftSummary>>();
}

async function deleteDraft(draftId: string): Promise<void> {
  const token = await getAuthToken();
  await apiClient.delete(`drafts/${draftId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

async function downloadDraft(downloadUrl: string, draftId: string): Promise<void> {
  const directory = FileSystem.documentDirectory;
  if (!directory) {
    throw new Error(STORAGE_ERROR_MESSAGE);
  }
  const fileUri = `${directory}${DRAFT_FILE_PREFIX}${draftId}${DRAFT_FILE_EXTENSION}`;
  await FileSystem.downloadAsync(downloadUrl, fileUri);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error(SHARE_UNAVAILABLE_MESSAGE);
  }
  await Sharing.shareAsync(fileUri);
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

export function HistoryScreen(): JSX.Element {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [downloadingDraftId, setDownloadingDraftId] = useState<string | null>(null);
  const [deletingDraftIds, setDeletingDraftIds] = useState<Set<string>>(() => new Set());

  const draftQueryKey = ['drafts', user?.id] as const;

  const draftsQuery = useInfiniteQuery({
    queryKey: draftQueryKey,
    queryFn: ({ pageParam = PAGE_START }) => fetchDraftHistory(pageParam),
    initialPageParam: PAGE_START,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    enabled: Boolean(user)
  });

  const drafts = useMemo(
    (): DraftSummary[] => draftsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [draftsQuery.data]
  );

  const isInitialLoading = !user || draftsQuery.isLoading;
  const isFetchingMore = draftsQuery.isFetchingNextPage;
  const isRetrying = isRefreshing || draftsQuery.isFetching;
  const hasError = Boolean(draftsQuery.error);
  const errorMessage = draftsQuery.error instanceof Error ? draftsQuery.error.message : ERROR_MESSAGE;

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await draftsQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [draftsQuery]);

  const handleEndReached = useCallback((): void => {
    if (draftsQuery.hasNextPage && !draftsQuery.isFetchingNextPage) {
      void draftsQuery.fetchNextPage();
    }
  }, [draftsQuery]);

  const handleDownload = useCallback(
    async (draft: DraftSummary): Promise<void> => {
      if (!draft.id || downloadingDraftId) {
        return;
      }
      if (!draft.generatedFileURL) {
        Alert.alert(DOWNLOAD_ERROR_TITLE, DOWNLOAD_LINK_MISSING_MESSAGE);
        return;
      }
      setDownloadingDraftId(draft.id);
      try {
        await downloadDraft(draft.generatedFileURL, draft.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : DOWNLOAD_ERROR_MESSAGE;
        Alert.alert(DOWNLOAD_ERROR_TITLE, message);
      } finally {
        setDownloadingDraftId(null);
      }
    },
    [downloadingDraftId]
  );

  const removeDraftFromCache = useCallback(
    (draftId: string): void => {
      queryClient.setQueryData<InfiniteData<PaginatedResponse<DraftSummary>>>(draftQueryKey, (current) => {
        if (!current) {
          return current;
        }
        const pages = current.pages.map((page) => ({
          ...page,
          data: page.data.filter((draft) => draft.id !== draftId)
        }));
        return { ...current, pages };
      });
    },
    [draftQueryKey, queryClient]
  );

  const markDeleting = useCallback((draftId: string): void => {
    setDeletingDraftIds((current) => {
      const next = new Set(current);
      next.add(draftId);
      return next;
    });
  }, []);

  const unmarkDeleting = useCallback((draftId: string): void => {
    setDeletingDraftIds((current) => {
      const next = new Set(current);
      next.delete(draftId);
      return next;
    });
  }, []);

  const handleDelete = useCallback(
    async (draftId: string): Promise<void> => {
      if (!draftId || deletingDraftIds.has(draftId)) {
        return;
      }
      markDeleting(draftId);
      try {
        await deleteDraft(draftId);
        removeDraftFromCache(draftId);
      } catch (error) {
        const message = error instanceof Error ? error.message : DELETE_ERROR_MESSAGE;
        Alert.alert(DELETE_ERROR_TITLE, message);
      } finally {
        unmarkDeleting(draftId);
      }
    },
    [deletingDraftIds, markDeleting, removeDraftFromCache, unmarkDeleting]
  );

  const handleDeletePress = useCallback(
    (draftId: string): void => {
      Alert.alert(DELETE_CONFIRM_TITLE, DELETE_CONFIRM_MESSAGE, [
        { text: CANCEL_LABEL, style: 'cancel' },
        {
          text: DELETE_LABEL,
          style: 'destructive',
          onPress: (): void => {
            void handleDelete(draftId);
          }
        }
      ]);
    },
    [handleDelete]
  );

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
        data={drafts}
        keyExtractor={(item): string => item.id}
        onEndReached={handleEndReached}
        onEndReachedThreshold={ON_END_THRESHOLD}
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={isRefreshing} />}
        renderItem={({ item }): JSX.Element => (
          <View className='mb-4'>
            <DraftHistoryItem
              categoryName={item.categoryName}
              createdAt={item.createdAt}
              isDeleting={deletingDraftIds.has(item.id)}
              isDownloading={downloadingDraftId === item.id}
              onDelete={(): void => handleDeletePress(item.id)}
              onDownload={(): void => {
                void handleDownload(item);
              }}
              templateName={item.templateName}
            />
          </View>
        )}
        ListHeaderComponent={
          <View className='mt-4'>
            <Text className='text-xl font-semibold text-slate-900'>{HEADER_TITLE}</Text>
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
