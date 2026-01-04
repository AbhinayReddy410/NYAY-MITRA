'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';

import type { ApiResponse, Category, User } from '@nyayamitra/shared';
import { DRAFT_LIMITS } from '@nyayamitra/shared';

import { Card } from '../../../components/ui/Card';
import { useAuth } from '../../../contexts/AuthContext';
import { apiClient } from '../../../lib/api';

const TITLE = 'Dashboard';
const CATEGORIES_TITLE = 'Template Categories';
const USAGE_TITLE = 'Monthly Usage';
const EMPTY_MESSAGE = 'No categories available';
const ERROR_MESSAGE = 'Failed to load categories. Please try again.';
const RETRY_LABEL = 'Retry';
const LOADING_MESSAGE = 'Loading...';
const DRAFTS_USED_LABEL = 'Drafts Used';
const CURRENT_PLAN_LABEL = 'Current Plan';
const UNLIMITED_LABEL = 'Unlimited';
const OF_LABEL = 'of';

type UserWithDraftsLimit = User & { draftsLimit: number };

async function fetchCategories(token: string): Promise<Category[]> {
  const response = await apiClient
    .get('categories', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<ApiResponse<Category[]>>();

  return response.data;
}

async function fetchUserProfile(token: string): Promise<UserWithDraftsLimit> {
  const response = await apiClient
    .get('user/profile', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<ApiResponse<UserWithDraftsLimit>>();

  return response.data;
}

export default function DashboardPage(): JSX.Element {
  const { user: authUser } = useAuth();

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      if (!authUser) {
        throw new Error('Not authenticated');
      }
      const token = await fetch('/api/auth/token').then((res) => res.text());
      return fetchCategories(token);
    },
    enabled: Boolean(authUser)
  });

  const userQuery = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: async (): Promise<UserWithDraftsLimit> => {
      if (!authUser) {
        throw new Error('Not authenticated');
      }
      const token = await fetch('/api/auth/token').then((res) => res.text());
      return fetchUserProfile(token);
    },
    enabled: Boolean(authUser)
  });

  const draftsLimit = useMemo((): number => {
    if (!userQuery.data) {
      return DRAFT_LIMITS.free;
    }
    return userQuery.data.draftsLimit;
  }, [userQuery.data]);

  const draftsUsed = useMemo((): number => {
    return userQuery.data?.draftsUsedThisMonth ?? 0;
  }, [userQuery.data]);

  const planName = useMemo((): string => {
    const plan = userQuery.data?.plan ?? 'free';
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }, [userQuery.data]);

  const draftsLimitText = useMemo((): string => {
    if (draftsLimit === Infinity) {
      return UNLIMITED_LABEL;
    }
    return draftsLimit.toString();
  }, [draftsLimit]);

  const handleRetry = useCallback((): void => {
    void categoriesQuery.refetch();
  }, [categoriesQuery]);

  if (categoriesQuery.isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <p className='text-slate-500'>{LOADING_MESSAGE}</p>
      </div>
    );
  }

  if (categoriesQuery.error) {
    return (
      <Card>
        <p className='text-sm text-red-600'>{ERROR_MESSAGE}</p>
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

  const categories = categoriesQuery.data ?? [];

  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-3xl font-semibold text-slate-900'>{TITLE}</h1>
      </div>

      {/* Usage Stats Card */}
      <Card>
        <h2 className='text-lg font-semibold text-slate-900'>{USAGE_TITLE}</h2>
        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div className='rounded-lg bg-slate-50 p-4'>
            <p className='text-sm text-slate-500'>{DRAFTS_USED_LABEL}</p>
            <p className='mt-1 text-2xl font-semibold text-slate-900'>
              {draftsUsed} {OF_LABEL} {draftsLimitText}
            </p>
            {draftsLimit !== Infinity ? (
              <div className='mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200'>
                <div
                  className='h-full bg-slate-900 transition-all'
                  style={{ width: `${Math.min((draftsUsed / draftsLimit) * 100, 100)}%` }}
                />
              </div>
            ) : null}
          </div>
          <div className='rounded-lg bg-slate-50 p-4'>
            <p className='text-sm text-slate-500'>{CURRENT_PLAN_LABEL}</p>
            <p className='mt-1 text-2xl font-semibold text-slate-900'>{planName}</p>
          </div>
        </div>
      </Card>

      {/* Categories Grid */}
      <div>
        <h2 className='text-lg font-semibold text-slate-900'>{CATEGORIES_TITLE}</h2>
        {categories.length === 0 ? (
          <Card className='mt-4'>
            <p className='text-sm text-slate-500'>{EMPTY_MESSAGE}</p>
          </Card>
        ) : (
          <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {categories.map((category) => (
              <Link key={category.id} href={`/category/${category.id}`}>
                <Card className='h-full transition hover:shadow-md hover:border-slate-300 cursor-pointer'>
                  <div className='flex flex-col'>
                    <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl'>
                      {category.icon}
                    </div>
                    <h3 className='mt-4 text-base font-semibold text-slate-900'>{category.name}</h3>
                    <p className='mt-1 text-sm text-slate-500 line-clamp-2'>{category.description}</p>
                    <p className='mt-2 text-xs text-slate-400'>
                      {category.templateCount} {category.templateCount === 1 ? 'template' : 'templates'}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
