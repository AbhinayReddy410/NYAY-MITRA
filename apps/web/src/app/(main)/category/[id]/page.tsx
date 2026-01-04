'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PaginatedResponse, Template } from '@nyayamitra/shared';

import { Card } from '../../../../components/ui/Card';
import { useAuth } from '../../../../contexts/AuthContext';
import { apiClient } from '../../../../lib/api';

type TemplateSummary = Omit<Template, 'variables' | 'templateFileURL'>;

const PAGE_START = 1;
const PAGE_LIMIT = 20;
const DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 1;

const AUTH_REQUIRED_MESSAGE = 'Please sign in again.';
const DEFAULT_CATEGORY_LABEL = 'Category';
const SEARCH_PLACEHOLDER = 'Search templates...';
const EMPTY_MESSAGE = 'No templates found';
const ERROR_MESSAGE = 'Unable to load templates.';
const RETRY_LABEL = 'Retry';
const LOADING_MESSAGE = 'Loading...';
const LOAD_MORE_LABEL = 'Load More';

type CategoryPageProps = {
  params: {
    id: string;
  };
};

async function fetchTemplates(params: {
  categoryId: string;
  page: number;
  search: string;
  token: string;
}): Promise<PaginatedResponse<TemplateSummary>> {
  const searchParams: Record<string, string> = {
    categoryId: params.categoryId,
    page: `${params.page}`,
    limit: `${PAGE_LIMIT}`
  };

  if (params.search.trim().length >= MIN_SEARCH_LENGTH) {
    searchParams.search = params.search.trim();
  }

  const response = await apiClient
    .get('templates', {
      headers: {
        Authorization: `Bearer ${params.token}`
      },
      searchParams
    })
    .json<PaginatedResponse<TemplateSummary>>();

  return response;
}

function getCategoryName(templates: TemplateSummary[], fallback: string): string {
  if (templates.length > 0 && templates[0].categoryName) {
    return templates[0].categoryName;
  }
  return fallback;
}

export default function CategoryPage({ params }: CategoryPageProps): JSX.Element {
  const { user } = useAuth();
  const categoryId = params.id;
  const [searchValue, setSearchValue] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  const templatesQuery = useInfiniteQuery({
    queryKey: ['templates', categoryId, debouncedSearch],
    queryFn: async ({ pageParam = PAGE_START }): Promise<PaginatedResponse<TemplateSummary>> => {
      if (!user) {
        throw new Error(AUTH_REQUIRED_MESSAGE);
      }
      const token = await fetch('/api/auth/token').then((res) => res.text());
      return fetchTemplates({ categoryId, page: pageParam, search: debouncedSearch, token });
    },
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
  const hasError = Boolean(templatesQuery.error);
  const errorMessage =
    templatesQuery.error instanceof Error ? templatesQuery.error.message : ERROR_MESSAGE;

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchValue(event.target.value);
  }, []);

  const handleRetry = useCallback((): void => {
    void templatesQuery.refetch();
  }, [templatesQuery]);

  const handleLoadMore = useCallback((): void => {
    if (templatesQuery.hasNextPage && !templatesQuery.isFetchingNextPage) {
      void templatesQuery.fetchNextPage();
    }
  }, [templatesQuery]);

  useEffect((): (() => void) => {
    const timeoutId = setTimeout((): void => {
      setDebouncedSearch(searchValue.trim());
    }, DEBOUNCE_MS);

    return (): void => {
      clearTimeout(timeoutId);
    };
  }, [searchValue]);

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
        <h1 className='text-3xl font-semibold text-slate-900'>{categoryName}</h1>
      </div>

      {/* Search */}
      <div>
        <input
          className='w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none md:w-96'
          onChange={handleSearchChange}
          placeholder={SEARCH_PLACEHOLDER}
          type='text'
          value={searchValue}
        />
      </div>

      {/* Template Grid */}
      {templates.length === 0 ? (
        <Card>
          <p className='text-sm text-slate-500'>{EMPTY_MESSAGE}</p>
        </Card>
      ) : (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {templates.map((template) => (
            <Link key={template.id} href={`/template/${template.id}`}>
              <Card className='h-full transition hover:shadow-md hover:border-slate-300 cursor-pointer'>
                <div className='flex flex-col'>
                  <h3 className='text-base font-semibold text-slate-900'>{template.name}</h3>
                  <p className='mt-2 text-sm text-slate-500 line-clamp-2'>{template.description}</p>
                  <div className='mt-4 flex items-center gap-4 text-xs text-slate-400'>
                    <span>{template.estimatedMinutes} min</span>
                    <span>{template.usageCount} uses</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Load More */}
      {templatesQuery.hasNextPage ? (
        <div className='flex justify-center'>
          <button
            className='rounded-lg bg-slate-100 px-6 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60'
            disabled={isFetchingMore}
            onClick={handleLoadMore}
            type='button'
          >
            {isFetchingMore ? LOADING_MESSAGE : LOAD_MORE_LABEL}
          </button>
        </div>
      ) : null}
    </div>
  );
}
