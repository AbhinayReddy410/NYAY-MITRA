import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const LOGIN_PATH = '/login';
const DASHBOARD_PATH = '/dashboard';
const AUTH_COOKIE_NAME = 'nyayamitra_auth';

const PROTECTED_PATHS = [
  '/dashboard',
  '/category',
  '/template',
  '/draft',
  '/history',
  '/profile'
];

function isAuthenticated(request: NextRequest): boolean {
  return Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(path => pathname.startsWith(path));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isLoggedIn = isAuthenticated(request);

  if (isProtectedPath(pathname) && !isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    return NextResponse.redirect(url);
  }

  if (pathname === LOGIN_PATH && isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = DASHBOARD_PATH;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/category/:path*',
    '/template/:path*',
    '/draft/:path*',
    '/history/:path*',
    '/profile/:path*',
    '/login'
  ]
};
