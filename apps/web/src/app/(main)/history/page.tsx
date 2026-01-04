'use client';

import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { Draft, PaginatedResponse } from '@nyayamitra/shared';

import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useAuth } from '../../../contexts/AuthContext';
import { apiClient } from '../../../lib/api';

type DraftSummary = Omit<Draft, 'variables'>;

const PAGE_START = 1;
const PAGE_LIMIT = 20;

const HEADER_TITLE = 'Draft History';
const EMPTY_MESSAGE = 'No drafts yet';
const ERROR_MESSAGE = 'Unable to load drafts.';
const RETRY_LABEL = 'Retry';
const AUTH_REQUIRED_MESSAGE = 'Please sign in again.';
const LOADING_MESSAGE = 'Loading...';
const LOAD_MORE_LABEL = 'Load More';

const DOWNLOAD_ERROR_MESSAGE = 'Unable to download draft.';
const DOWNLOAD_LINK_MISSING_MESSAGE = 'Download link unavailable.';

const DELETE_CONFIRM_MESSAGE = 'Are you sure you want to delete this draft? This action cannot be undone.';
const DELETE_ERROR_MESSAGE = 'Unable to delete draft.';

const TABLE_HEADERS = ['Template', 'Category', 'Created', 'Actions'] as const;

const DATE_LOCALE = 'en-IN';
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(DATE_LOCALE, DATE_OPTIONS);
}

async function fetchDraftHistory(page: number, token: string): Promise<PaginatedResponse<DraftSummary>> {
  const response = await apiClient
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

  return response;
}

async function deleteDraft(draftId: string, token: string): Promise<void> {
  await apiClient.delete(`drafts/${draftId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export default function HistoryPage(): JSX.Element {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deletingDraftIds, setDeletingDraftIds] = useState<Set<string>>(() => new Set());

  const draftQueryKey = useMemo(() => ['drafts', user?.id] as const, [user?.id]);

  const draftsQuery = useInfiniteQuery({
    queryKey: draftQueryKey,
    queryFn: async ({ pageParam = PAGE_START }): Promise<PaginatedResponse<DraftSummary>> => {
      if (!user) {
        throw new Error(AUTH_REQUIRED_MESSAGE);
      }
      const token = await fetch('/api/auth/token').then((res) => res.text());
      return fetchDraftHistory(pageParam, token);
    },
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
  const hasError = Boolean(draftsQuery.error);
  const errorMessage = draftsQuery.error instanceof Error ? draftsQuery.error.message : ERROR_MESSAGE;

  const handleDownload = useCallback((draft: DraftSummary): void => {
    if (!draft.generatedFileURL) {
      alert(DOWNLOAD_LINK_MISSING_MESSAGE);
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = draft.generatedFileURL;
      link.download = `${draft.id}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert(DOWNLOAD_ERROR_MESSAGE);
    }
  }, []);

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

  const handleDelete = useCallback(
    async (draftId: string): Promise<void> => {
      if (!user || deletingDraftIds.has(draftId)) {
        return;
      }

      if (!confirm(DELETE_CONFIRM_MESSAGE)) {
        return;
      }

      setDeletingDraftIds((current) => {
        const next = new Set(current);
        next.add(draftId);
        return next;
      });

      try {
        const token = await fetch('/api/auth/token').then((res) => res.text());
        await deleteDraft(draftId, token);
        removeDraftFromCache(draftId);
      } catch {
        alert(DELETE_ERROR_MESSAGE);
      } finally {
        setDeletingDraftIds((current) => {
          const next = new Set(current);
          next.delete(draftId);
          return next;
        });
      }
    },
    [deletingDraftIds, removeDraftFromCache, user]
  );

  const handleLoadMore = useCallback((): void => {
    if (draftsQuery.hasNextPage && !draftsQuery.isFetchingNextPage) {
      void draftsQuery.fetchNextPage();
    }
  }, [draftsQuery]);

  const handleRetry = useCallback((): void => {
    void draftsQuery.refetch();
  }, [draftsQuery]);

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

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-semibold text-slate-900'>{HEADER_TITLE}</h1>
      </div>

      {drafts.length === 0 ? (
        <Card>
          <p className='text-sm text-slate-500'>{EMPTY_MESSAGE}</p>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className='hidden lg:block'>
            <Card className='p-0 overflow-hidden'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-slate-200'>
                    {TABLE_HEADERS.map((header) => (
                      <th
                        key={header}
                        className='px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider'
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((draft, index) => (
                    <tr
                      key={draft.id}
                      className={`${index !== drafts.length - 1 ? 'border-b border-slate-200' : ''}`}
                    >
                      <td className='px-6 py-4 text-sm font-medium text-slate-900'>{draft.templateName}</td>
                      <td className='px-6 py-4 text-sm text-slate-500'>{draft.categoryName}</td>
                      <td className='px-6 py-4 text-sm text-slate-500'>{formatDate(draft.createdAt)}</td>
                      <td className='px-6 py-4'>
                        <div className='flex items-center gap-2'>
                          <button
                            className='text-sm font-medium text-slate-900 hover:text-slate-700'
                            onClick={(): void => handleDownload(draft)}
                            type='button'
                          >
                            Download
                          </button>
                          <button
                            className='text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60'
                            disabled={deletingDraftIds.has(draft.id)}
                            onClick={(): void => {
                              void handleDelete(draft.id);
                            }}
                            type='button'
                          >
                            {deletingDraftIds.has(draft.id) ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className='grid grid-cols-1 gap-4 lg:hidden'>
            {drafts.map((draft) => (
              <Card key={draft.id}>
                <div className='space-y-3'>
                  <div>
                    <h3 className='text-base font-semibold text-slate-900'>{draft.templateName}</h3>
                    <p className='mt-1 text-sm text-slate-500'>{draft.categoryName}</p>
                    <p className='mt-1 text-xs text-slate-400'>{formatDate(draft.createdAt)}</p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <button
                      className='text-sm font-medium text-slate-900 hover:text-slate-700'
                      onClick={(): void => handleDownload(draft)}
                      type='button'
                    >
                      Download
                    </button>
                    <button
                      className='text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60'
                      disabled={deletingDraftIds.has(draft.id)}
                      onClick={(): void => {
                        void handleDelete(draft.id);
                      }}
                      type='button'
                    >
                      {deletingDraftIds.has(draft.id) ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Load More */}
          {draftsQuery.hasNextPage ? (
            <div className='flex justify-center'>
              <Button disabled={isFetchingMore} onClick={handleLoadMore} type='button' variant='secondary'>
                {isFetchingMore ? LOADING_MESSAGE : LOAD_MORE_LABEL}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
