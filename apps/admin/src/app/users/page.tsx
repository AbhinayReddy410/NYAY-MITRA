'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { PaginatedResponse, User } from '@nyayamitra/shared';

import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../lib/api';
import { getCurrentUserToken } from '../../lib/firebase';

const HEADER_TITLE = 'Users';
const SEARCH_PLACEHOLDER = 'Search users by email or phone...';
const TABLE_EMAIL_HEADER = 'Email';
const TABLE_PHONE_HEADER = 'Phone';
const TABLE_PLAN_HEADER = 'Plan';
const TABLE_DRAFTS_HEADER = 'Drafts Used';
const TABLE_STATUS_HEADER = 'Subscription';
const PREVIOUS_LABEL = 'Previous';
const NEXT_LABEL = 'Next';
const LOADING_MESSAGE = 'Loading users...';
const ERROR_MESSAGE = 'Unable to load users';
const EMPTY_MESSAGE = 'No users found';

const PLAN_FREE = 'Free';
const PLAN_PRO = 'Pro';
const PLAN_UNLIMITED = 'Unlimited';

const STATUS_ACTIVE = 'Active';
const STATUS_PAST_DUE = 'Past Due';
const STATUS_CANCELLED = 'Cancelled';
const STATUS_NONE = 'None';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEBOUNCE_DELAY = 300;

const NUMBER_FORMAT = new Intl.NumberFormat('en-IN');

async function fetchUsers(page: number, limit: number, search: string): Promise<PaginatedResponse<User>> {
  const token = await getCurrentUserToken();
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  });

  if (search) {
    params.set('search', search);
  }

  const response = await apiClient
    .get(`admin/users?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<PaginatedResponse<User>>();

  return response;
}

function getPlanLabel(plan: string): string {
  switch (plan) {
    case 'free':
      return PLAN_FREE;
    case 'pro':
      return PLAN_PRO;
    case 'unlimited':
      return PLAN_UNLIMITED;
    default:
      return plan;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return STATUS_ACTIVE;
    case 'past_due':
      return STATUS_PAST_DUE;
    case 'cancelled':
      return STATUS_CANCELLED;
    case 'none':
      return STATUS_NONE;
    default:
      return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'past_due':
      return 'bg-yellow-100 text-yellow-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'none':
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export default function UsersPage(): JSX.Element {
  const [page, setPage] = useState<number>(DEFAULT_PAGE);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', page, debouncedSearch],
    queryFn: (): Promise<PaginatedResponse<User>> => fetchUsers(page, DEFAULT_LIMIT, debouncedSearch)
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setSearch(value);
    setPage(DEFAULT_PAGE);

    setTimeout((): void => {
      setDebouncedSearch(value);
    }, DEBOUNCE_DELAY);
  }, []);

  const handlePreviousPage = useCallback((): void => {
    setPage((prev) => Math.max(prev - 1, DEFAULT_PAGE));
  }, []);

  const handleNextPage = useCallback((): void => {
    setPage((prev) => prev + 1);
  }, []);

  const canGoPrevious = useMemo((): boolean => page > DEFAULT_PAGE, [page]);
  const canGoNext = useMemo(
    (): boolean => Boolean(usersQuery.data && page < usersQuery.data.pagination.totalPages),
    [page, usersQuery.data]
  );

  return (
    <AdminLayout>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <h1 className='text-3xl font-semibold text-slate-900'>{HEADER_TITLE}</h1>
        </div>

        <Card>
          <div className='mb-6'>
            <Input
              onChange={handleSearchChange}
              placeholder={SEARCH_PLACEHOLDER}
              type='text'
              value={search}
            />
          </div>

          {usersQuery.isLoading ? (
            <div className='py-8 text-center text-sm text-slate-600'>{LOADING_MESSAGE}</div>
          ) : usersQuery.error ? (
            <div className='py-8 text-center text-sm text-red-600'>{ERROR_MESSAGE}</div>
          ) : !usersQuery.data?.data.length ? (
            <div className='py-8 text-center text-sm text-slate-600'>{EMPTY_MESSAGE}</div>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b border-slate-200'>
                      <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                        {TABLE_EMAIL_HEADER}
                      </th>
                      <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                        {TABLE_PHONE_HEADER}
                      </th>
                      <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                        {TABLE_PLAN_HEADER}
                      </th>
                      <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                        {TABLE_DRAFTS_HEADER}
                      </th>
                      <th className='pb-3 text-left text-sm font-medium text-slate-600'>
                        {TABLE_STATUS_HEADER}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersQuery.data.data.map((user) => (
                      <tr className='border-b border-slate-100' key={user.uid}>
                        <td className='py-4 text-sm text-slate-900'>{user.email || '—'}</td>
                        <td className='py-4 text-sm text-slate-600'>{user.phone || '—'}</td>
                        <td className='py-4'>
                          <span className='inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800'>
                            {getPlanLabel(user.plan)}
                          </span>
                        </td>
                        <td className='py-4 text-sm text-slate-600'>
                          {NUMBER_FORMAT.format(user.draftsUsedThisMonth)}
                        </td>
                        <td className='py-4'>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(user.subscriptionStatus)}`}
                          >
                            {getStatusLabel(user.subscriptionStatus)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className='mt-6 flex items-center justify-between'>
                <div className='text-sm text-slate-600'>
                  Page {usersQuery.data.pagination.page} of {usersQuery.data.pagination.totalPages} (
                  {NUMBER_FORMAT.format(usersQuery.data.pagination.total)} total)
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
