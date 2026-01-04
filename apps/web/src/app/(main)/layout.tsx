'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';

const SIDEBAR_TITLE = 'NyayaMitra';
const MENU_LABEL = 'Menu';
const CLOSE_LABEL = 'Close';
const SIGN_OUT_LABEL = 'Sign Out';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/history', label: 'Draft History' },
  { href: '/profile', label: 'Profile' },
  { href: '/subscription', label: 'Subscription' }
] as const;

type MainLayoutProps = {
  children: ReactNode;
};

export default function MainLayout({ children }: MainLayoutProps): JSX.Element {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const handleSignOut = useCallback(async (): Promise<void> => {
    try {
      await signOut();
    } catch {
      // Error handled by AuthContext
    }
  }, [signOut]);

  const toggleMobileMenu = useCallback((): void => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback((): void => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <div className='min-h-screen bg-slate-50'>
      <div className='flex min-h-screen'>
        {/* Desktop Sidebar */}
        <aside className='hidden w-64 flex-col border-r border-slate-200 bg-white px-6 py-8 lg:flex'>
          <div className='flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 text-white text-xl font-semibold'>
            NM
          </div>
          <div className='mt-4 text-lg font-semibold text-slate-900'>{SIDEBAR_TITLE}</div>

          <nav className='mt-8 flex flex-1 flex-col gap-2'>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  href={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className='mt-auto border-t border-slate-200 pt-4'>
            {profile?.email || profile?.phone ? (
              <p className='text-sm text-slate-500 truncate'>{profile.email || profile.phone}</p>
            ) : null}
            <button
              className='mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 transition'
              onClick={handleSignOut}
              type='button'
            >
              {SIGN_OUT_LABEL}
            </button>
          </div>
        </aside>

        <div className='flex flex-1 flex-col'>
          {/* Mobile Header */}
          <header className='flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 lg:hidden'>
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-semibold'>
                NM
              </div>
              <span className='font-semibold text-slate-900'>{SIDEBAR_TITLE}</span>
            </div>
            <button
              className='text-sm font-medium text-slate-600 hover:text-slate-900'
              onClick={toggleMobileMenu}
              type='button'
            >
              {isMobileMenuOpen ? CLOSE_LABEL : MENU_LABEL}
            </button>
          </header>

          {/* Mobile Menu */}
          {isMobileMenuOpen ? (
            <div className='border-b border-slate-200 bg-white px-6 py-4 lg:hidden'>
              <nav className='flex flex-col gap-2'>
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      href={item.href}
                      onClick={closeMobileMenu}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className='mt-4 border-t border-slate-200 pt-4'>
                {profile?.email || profile?.phone ? (
                  <p className='text-sm text-slate-500 truncate'>{profile.email || profile.phone}</p>
                ) : null}
                <button
                  className='mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 transition'
                  onClick={handleSignOut}
                  type='button'
                >
                  {SIGN_OUT_LABEL}
                </button>
              </div>
            </div>
          ) : null}

          {/* Main Content */}
          <main className='flex-1 px-6 py-8'>{children}</main>
        </div>
      </div>
    </div>
  );
}
