// proxy.ts (formerly middleware.ts)
// Edge Proxy: cookie refresh + protected/auth route redirects
// Runs BEFORE page routes. API routes are excluded by matcher.
// Next.js 16 renamed Middleware to Proxy — kept in sync.
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/meet', '/class', '/classrooms', '/lobby', '/settings', '/profile'];

// Auth routes that should redirect if already authenticated
const AUTH_ROUTES = ['/auth/signup', '/auth/reset', '/auth'];

// Deprecated routes that need redirects to new dual-product paths
const DEPRECATED_ROUTES = [
  { from: '/meeting', to: null }, // handled dynamically below
];

// Check if Supabase is configured
function isSupabaseConfigured(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  return !!(supabaseUrl && supabaseAnonKey);
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Request-ID', crypto.randomUUID());

  // ── Subdomain detection for class.conferly.site ──────────────────────
  const host = request.headers.get('host') || '';
  const isClassSubdomain = host.startsWith('class.');

  if (isClassSubdomain) {
    // On class subdomain, rewrite root to Class landing page
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/class', request.url));
    }
    // Rewrite /pricing to class pricing
    if (pathname === '/pricing') {
      return NextResponse.rewrite(new URL('/class/pricing', request.url));
    }
    // Prevent Meet routes on class subdomain
    if (pathname.startsWith('/meet')) {
      return NextResponse.redirect(new URL('/class/dashboard', request.url));
    }
    // Rewrite /classrooms paths to the full page route on class subdomain
    if (pathname.startsWith('/classrooms')) {
      return NextResponse.rewrite(new URL(`/class${pathname}`, request.url));
    }
    // If user is signed in and hits the class subdomain root dashboard
    if (pathname === '/dashboard') {
      return NextResponse.rewrite(new URL('/class/dashboard', request.url));
    }
  }

  // Edge SSR client: refreshes expired session cookies automatically
  // Skip auth check if Supabase is not configured (e.g., during initial deployment)
  let user = null;
  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseServerClient({ request, response });
      const { data } = await supabase.auth.getUser();
      user = data?.user ?? null;
    } catch (error) {
      console.error('[Proxy] Supabase auth error:', error);
      // Continue without auth - let the page handle the error
    }
  }

  // Check for deprecated routes and redirect to new paths
  const deprecatedMatch = DEPRECATED_ROUTES.find((route) => pathname === route.from || pathname.startsWith(route.from + '/'));
  if (deprecatedMatch) {
    if (deprecatedMatch.to === null) {
      // Dynamic redirect based on query params
      const url = new URL(request.url);
      const slug = url.searchParams.get('slug');
      const type = url.searchParams.get('type');
      if (type === 'classroom' && slug) {
        return NextResponse.redirect(new URL(`/class/classrooms/${slug}`, request.url));
      }
      if (slug) {
        return NextResponse.redirect(new URL(`/meet/rooms/${slug}`, request.url));
      }
      return NextResponse.redirect(new URL('/meet/dashboard', request.url));
    }
    const redirectPath = deprecatedMatch.to + pathname.slice(deprecatedMatch.from.length);
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !user) {
    const signInUrl = new URL('/auth', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthRoute && user) {
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
