// proxy.ts
// Next.js 16+ proxy handler for route protection and security
// Replaces deprecated middleware.ts pattern
import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from './lib/monitoring';

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/lobby', '/meeting', '/settings', '/profile'];

// Auth routes that should redirect if already authenticated
const AUTH_ROUTES = ['/auth/signup', '/auth/reset', '/auth'];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Create response with security headers
  const response = NextResponse.next();
  
  // Add security headers
  response.headers.set('X-Request-ID', crypto.randomUUID());
  
  // Track client IP for rate limiting
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  response.headers.set('X-Client-IP', clientIp);
  
  // Check for session cookie
  const sessionCookie = request.cookies.get('supabase-auth-token') ||
                       request.cookies.get('sb-access-token');
  
  // Check if this is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname.startsWith(route)
  );
  
  // Check if this is an auth route
  const isAuthRoute = AUTH_ROUTES.some(route => 
    pathname.startsWith(route)
  );
  
  // Redirect protected routes to sign-in if no session
  if (isProtectedRoute && !sessionCookie) {
    trackEvent({
      type: 'auth_failure',
      stage: 'proxy',
      reason: 'missing_session',
      route: pathname,
      timestamp: Date.now(),
    });
    // Redirect to canonical auth page; preserve requested path as `redirect` param
    const signInUrl = new URL('/auth', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }
  
  // Redirect auth routes to dashboard if already authenticated
  if (isAuthRoute && sessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, icons, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
