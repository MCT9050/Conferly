// lib/supabase/server.ts
// Server-side Supabase client using @supabase/ssr createServerClient.
// Context-aware: accepts optional request/response for cookie manipulation.
// Handles cookie chunking (sb-access-token.0, .1, etc.) automatically.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ClientOptions {
  request?: NextRequest | Request;
  response?: NextResponse;
}

/**
 * Derive the cookie domain from the Host header.
 * - On localhost, no domain is set (defaults to exact host).
 * - On production, returns a wildcard domain (.conferly.site) so cookies
 *   are shared across all subdomains (class.conferly.site, meet.conferly.site, etc.).
 *
 * Respects COOKIE_DOMAIN env var if set explicitly.
 */
function deriveCookieDomain(request?: NextRequest | Request): string | undefined {
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN.startsWith('.')
      ? process.env.COOKIE_DOMAIN
      : `.${process.env.COOKIE_DOMAIN}`;
  }

  if (!request) return undefined;

  const host = request.headers.get('host') ?? '';
  const normalizedHost = host.replace(/:\d+$/, '');

  // No domain override for localhost — cookies stay host-specific
  if (normalizedHost.includes('localhost') || normalizedHost.includes('127.0.0.1')) {
    return undefined;
  }

  // For production subdomains like class.conferly.site, derive .conferly.site
  const parts = normalizedHost.split('.');
  if (parts.length > 2) {
    return `.${parts.slice(-2).join('.')}`;
  }

  return `.${normalizedHost}`;
}

/**
 * Supabase SSR server client (cookie-based).
 *
 * When you are in middleware, pass BOTH `{ request, response }` so the SDK
 * can read + write cookies on the active Edge stream.
 *
 * When you are in a Route Handler / Server Action, pass `{ request }` so the
 * SDK can read cookies from the incoming request.
 *
 * When you are in a Server Component (no request object), pass nothing and
 * the SDK will use `cookies()` from `next/headers`.
 */
export function createSupabaseServerClient(
  { request, response }: ClientOptions = {}
): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or anon key environment variables');
  }

  const domain = deriveCookieDomain(request);

  const cookieOptions: CookieOptions = {
    domain: domain ?? undefined,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      /**
       * Return all cookies as { name, value, options } objects.
       * Implementation is defensive because Next.js cookie store typing varies
       * across Next.js versions/runtimes.
       */
      getAll() {
        if (
          request &&
          'cookies' in request &&
          typeof (request as NextRequest).cookies?.getAll === 'function'
        ) {
          // In Edge middleware/NextRequest, cookies.getAll() is available.
          return (request as NextRequest).cookies.getAll();
        }

        const store: any = cookies();

        // Some Next.js versions expose getAll()
        if (typeof store.getAll === 'function') {
          return store.getAll();
        }

        // Fallback: attempt to iterate cookies and convert to expected shape.
        const entries: Array<[string, string]> = Array.from(
          store.entries?.() ?? []
        );

        return entries.map(([name, value]) => ({
          name,
          value,
          options: undefined,
        }));
      },

      /**
       * Set multiple cookies.
       * In middleware we can write via response.cookies.set().
       * In Route Handlers we can usually write via next/headers cookies() store.
       *
       * IMPORTANT: The second `headers` param carries cache-control headers
       * that Supabase requires when setting auth cookies. We must apply them.
       */
      setAll(
        cookiesToSet: ReadonlyArray<{
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }>,
        headers: Record<string, string>
      ) {
        if (response) {
          // Apply cache-control headers that Supabase requires when setting auth cookies
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              response.cookies.set(name, value, options);
            } catch {
              // Cookie writes may be restricted in some runtimes.
            }
          });
          return;
        }

        // Route Handler / Server Action case: try writing via next/headers cookies store.
        // If this is forbidden (e.g. Server Components), swallow safely.
        try {
          const store: any = cookies();
          if (typeof store.set === 'function') {
            cookiesToSet.forEach(({ name, value, options }) => {
              store.set(name, value, {
                ...cookieOptions,
                ...options,
              });
            });
          }
        } catch {
          // Expected in Server Components where cookie writes are forbidden.
        }
      },
    },
  });
}