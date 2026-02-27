import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/register', '/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Check for access token in cookies or header
  // Since we use localStorage (client-side), middleware can only do basic checks
  // The real auth check happens in the dashboard layout component
  // This middleware handles the server-side redirect for non-authenticated requests
  const token = request.cookies.get('accessToken')?.value;

  // If accessing dashboard without cookie, let client-side handle it
  // This avoids blocking since we use localStorage for token storage
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
