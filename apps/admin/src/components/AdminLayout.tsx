'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { Button } from './ui/Button';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const APP_TITLE = 'NyayaMitra Admin';
const SIGN_OUT_LABEL = 'Sign Out';
const LOGIN_PATH = '/login';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/templates', label: 'Templates' },
  { href: '/categories', label: 'Categories' },
  { href: '/users', label: 'Users' }
] as const;

type AdminLayoutProps = {
  children: ReactNode;
};

export function AdminLayout({ children }: AdminLayoutProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut, isAuthenticated } = useAdminAuth();

  const handleSignOut = useCallback(async (): Promise<void> => {
    try {
      await signOut();
      router.push(LOGIN_PATH);
    } catch {
      router.push(LOGIN_PATH);
    }
  }, [signOut, router]);

  if (!isAuthenticated) {
    router.replace(LOGIN_PATH);
    return <div />;
  }

  return (
    <div className='flex min-h-screen flex-col bg-slate-50'>
      <header className='border-b border-slate-200 bg-white'>
        <div className='mx-auto max-w-7xl px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-xl font-semibold text-slate-900'>{APP_TITLE}</h1>
              {user?.email ? <p className='text-sm text-slate-600'>{user.email}</p> : null}
            </div>
            <Button onClick={handleSignOut} variant='ghost'>
              {SIGN_OUT_LABEL}
            </Button>
          </div>
        </div>
      </header>

      <div className='flex flex-1'>
        <aside className='w-64 border-r border-slate-200 bg-white px-6 py-8'>
          <nav className='space-y-1'>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  className={`block rounded-lg px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className='flex-1 px-8 py-8'>{children}</main>
      </div>
    </div>
  );
}
