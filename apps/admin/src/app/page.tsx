'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAdminAuth } from '../contexts/AdminAuthContext';

const DASHBOARD_PATH = '/dashboard';
const LOGIN_PATH = '/login';

export default function HomePage(): JSX.Element {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAdminAuth();

  useEffect((): void => {
    if (isLoading) {
      return;
    }

    if (isAuthenticated) {
      router.replace(DASHBOARD_PATH);
    } else {
      router.replace(LOGIN_PATH);
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-50'>
      <div className='text-sm text-slate-600'>Loading...</div>
    </div>
  );
}
