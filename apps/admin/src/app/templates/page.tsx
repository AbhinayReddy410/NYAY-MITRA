'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Category, PaginatedResponse, Template } from '@nyayamitra/shared';

import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../lib/api';
import { getCurrentUserToken } from '../../lib/firebase';

const HEADER_TITLE = 'Templates';
const CREATE_NEW_LABEL = 'Create Template';
const SEARCH_PLACEHOLDER = 'Search templates...';
const ALL_CATEGORIES_LABEL = 'All Categories';
const ACTIVE_LABEL = 'Active';
const INACTIVE_LABEL = 'Inactive';
const ALL_STATUS_LABEL = 'All Status';
const TABLE_NAME_HEADER = 'Name';
const TABLE_CATEGORY_HEADER = 'Category';
const TABLE_STATUS_HEADER = 'Status';
const TABLE_ACTIONS_HEADER = 'Actions';
const EDIT_LABEL = 'Edit';
const PREVIOUS_LABEL = 'Previous';
const NEXT_LABEL = 'Next';
const LOADING_MESSAGE = 'Loading templates...';
const ERROR_MESSAGE = 'Unable to load templates';
const EMPTY_MESSAGE = 'No templates found';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEBOUNCE_DELAY = 300;

type TemplateFilters = {
  search: string;
  categoryId: string;
  status: string;
};

async function fetchTemplates(
  page: number,
  limit: number,
  search: string,
  categoryId: string,
  status: string
): Promise<PaginatedResponse<Template>> {
  const token = await getCurrentUserToken();
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  });

  if (search) {
    params.set('search', search);
  }
  if (categoryId) {
    params.set('categoryId', categoryId);
  }
  if (status) {
    params.set('isActive', status);
  }

  const response = await apiClient
    .get(`admin/templates?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<PaginatedResponse<Template>>();

  return response;
}

async function fetchCategories(): Promise<Category[]> {
  const token = await getCurrentUserToken();
  const response = await apiClient
    .get('categories', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<{ data: Category[] }>();

  return response.data;
}

export default function TemplatesPage(): JSX.Element {
  const [page, setPage] = useState<number>(DEFAULT_PAGE);
  const [filters, setFilters] = useState<TemplateFilters>({
    search: '',
    categoryId: '',
    status: ''
  });
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories
  });

  const templatesQuery = useQuery({
    queryKey: ['admin', 'templates', page, debouncedSearch, filters.categoryId, filters.status],
    queryFn: (): Promise<PaginatedResponse<Template>> =>
      fetchTemplates(page, DEFAULT_LIMIT, debouncedSearch, filters.categoryId, filters.status)
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, search: value }));
    setPage(DEFAULT_PAGE);

    setTimeout((): void => {
      setDebouncedSearch(value);
    }, DEBOUNCE_DELAY);
  }, []);

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
    setFilters((prev) => ({ ...prev, categoryId: e.target.value }));
    setPage(DEFAULT_PAGE);
  }, []);

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
    setFilters((prev) => ({ ...prev, status: e.target.value }));
    setPage(DEFAULT_PAGE);
  }, []);

  const handlePreviousPage = useCallback((): void => {
    setPage((prev) => Math.max(prev - 1, DEFAULT_PAGE));
  }, []);

  const handleNextPage = useCallback((): void => {
    setPage((prev) => prev + 1);
  }, []);

  const canGoPrevious = useMemo((): boolean => page > DEFAULT_PAGE, [page]);
  const canGoNext = useMemo(
    (): boolean =>
      Boolean(templatesQuery.data && page < templatesQuery.data.pagination.totalPages),
    [page, templatesQuery.data]
  );

  return (
    <AdminLayout>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <h1 className='text-3xl font-semibold text-slate-900'>{HEADER_TITLE}</h1>
          <Link href='/templates/new'>
            <Button>{CREATE_NEW_LABEL}</Button>
          </Link>
        </div>

        <Card>
          <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
            <Input
              onChange={handleSearchChange}
              placeholder={SEARCH_PLACEHOLDER}
              type='text'
              value={filters.search}
            />

            <select
              className='w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none'
              onChange={handleCategoryChange}
              value={filters.categoryId}
            >
              <option value=''>{ALL_CATEGORIES_LABEL}</option>
              {categoriesQuery.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              className='w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none'
              onChange={handleStatusChange}
              value={filters.status}
            >
              <option value=''>{ALL_STATUS_LABEL}</option>
              <option value='true'>{ACTIVE_LABEL}</option>
              <option value='false'>{INACTIVE_LABEL}</option>
            </select>
          </div>

          {templatesQuery.isLoading ? (
            <div className='py-8 text-center text-sm text-slate-600'>{LOADING_MESSAGE}</div>
          ) : templatesQuery.error ? (
            <div className='py-8 text-center text-sm text-red-600'>{ERROR_MESSAGE}</div>
          ) : !templatesQuery.data?.data.length ? (
            <div className='py-8 text-center text-sm text-slate-600'>{EMPTY_MESSAGE}</div>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b border-slate-200'>
                      <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                        {TABLE_NAME_HEADER}
                      </th>
                      <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                        {TABLE_CATEGORY_HEADER}
                      </th>
                      <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                        {TABLE_STATUS_HEADER}
                      </th>
                      <th className='pb-3 text-right text-sm font-medium text-slate-600'>
                        {TABLE_ACTIONS_HEADER}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {templatesQuery.data.data.map((template) => (
                      <tr className='border-b border-slate-100' key={template.id}>
                        <td className='py-4 text-sm text-slate-900'>{template.name}</td>
                        <td className='py-4 text-sm text-slate-600'>{template.categoryName}</td>
                        <td className='py-4'>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              template.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {template.isActive ? ACTIVE_LABEL : INACTIVE_LABEL}
                          </span>
                        </td>
                        <td className='py-4 text-right'>
                          <Link href={`/templates/${template.id}`}>
                            <Button variant='ghost'>{EDIT_LABEL}</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className='mt-6 flex items-center justify-between'>
                <div className='text-sm text-slate-600'>
                  Page {templatesQuery.data.pagination.page} of{' '}
                  {templatesQuery.data.pagination.totalPages}
                </div>
                <div className='flex gap-2'>
                  <Button disabled={!canGoPrevious} onClick={handlePreviousPage} variant='secondary'>
                    {PREVIOUS_LABEL}
                  </Button>
                  <Button disabled={!canGoNext} onClick={handleNextPage} variant='secondary'>
                    {NEXT_LABEL}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
