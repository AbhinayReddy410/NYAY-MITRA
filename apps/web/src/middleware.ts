import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const LOGIN_PATH = '/login';
const DASHBOARD_PATH = '/dashboard';
const AUTH_COOKIE_NAME = 'nyayamitra_auth';

function isAuthenticated(request: NextRequest): boolean {
  return Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isLoggedIn = isAuthenticated(request);

  if (pathname.startsWith(DASHBOARD_PATH) && !isLoggedIn) {
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
  matcher: ['/dashboard/:path*', '/login']
} as const;
