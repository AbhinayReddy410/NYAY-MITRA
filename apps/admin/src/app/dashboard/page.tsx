'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { AdminLayout } from '../../components/AdminLayout';
import { Card } from '../../components/ui/Card';
import { firebaseAuth } from '../../lib/firebase';
import { apiClient } from '../../lib/api';

type AdminStats = {
  totalUsers: number;
  totalDrafts: number;
  monthlyRevenue: number;
  activeSubscriptions: number;
};

const HEADER_TITLE = 'Dashboard';
const USERS_LABEL = 'Total Users';
const DRAFTS_LABEL = 'Total Drafts';
const REVENUE_LABEL = 'Monthly Revenue';
const SUBSCRIPTIONS_LABEL = 'Active Subscriptions';
const ERROR_MESSAGE = 'Unable to load stats';
const LOADING_MESSAGE = 'Loading...';

const CURRENCY_FORMAT = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const NUMBER_FORMAT = new Intl.NumberFormat('en-IN');

async function fetchAdminStats(): Promise<AdminStats> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const token = await currentUser.getIdToken();
  const response = await apiClient
    .get('admin/stats', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .json<{ data: AdminStats }>();

  return response.data;
}

export default function DashboardPage(): JSX.Element {
  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchAdminStats
  });

  const formattedRevenue = useMemo((): string => {
    if (!statsQuery.data) {
      return '₹0';
    }
    return CURRENCY_FORMAT.format(statsQuery.data.monthlyRevenue);
  }, [statsQuery.data]);

  const formattedUsers = useMemo((): string => {
    if (!statsQuery.data) {
      return '0';
    }
    return NUMBER_FORMAT.format(statsQuery.data.totalUsers);
  }, [statsQuery.data]);

  const formattedDrafts = useMemo((): string => {
    if (!statsQuery.data) {
      return '0';
    }
    return NUMBER_FORMAT.format(statsQuery.data.totalDrafts);
  }, [statsQuery.data]);

  const formattedSubscriptions = useMemo((): string => {
    if (!statsQuery.data) {
      return '0';
    }
    return NUMBER_FORMAT.format(statsQuery.data.activeSubscriptions);
  }, [statsQuery.data]);

  return (
    <AdminLayout>
      <div className='space-y-6'>
        <h1 className='text-3xl font-semibold text-slate-900'>{HEADER_TITLE}</h1>

        {statsQuery.isLoading ? (
          <div className='text-sm text-slate-600'>{LOADING_MESSAGE}</div>
        ) : statsQuery.error ? (
          <div className='text-sm text-red-600'>{ERROR_MESSAGE}</div>
        ) : (
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
            <Card>
              <div className='text-sm font-medium text-slate-600'>{USERS_LABEL}</div>
              <div className='mt-2 text-3xl font-semibold text-slate-900'>{formattedUsers}</div>
            </Card>

            <Card>
              <div className='text-sm font-medium text-slate-600'>{DRAFTS_LABEL}</div>
              <div className='mt-2 text-3xl font-semibold text-slate-900'>{formattedDrafts}</div>
            </Card>

            <Card>
              <div className='text-sm font-medium text-slate-600'>{REVENUE_LABEL}</div>
              <div className='mt-2 text-3xl font-semibold text-slate-900'>{formattedRevenue}</div>
            </Card>

            <Card>
              <div className='text-sm font-medium text-slate-600'>{SUBSCRIPTIONS_LABEL}</div>
              <div className='mt-2 text-3xl font-semibold text-slate-900'>{formattedSubscriptions}</div>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
