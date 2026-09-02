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
  // Explicit configuration always wins. This is the only supported mechanism
  // for sharing auth cookies across arbitrary custom domains.
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN.startsWith('.')
      ? process.env.COOKIE_DOMAIN
      : `.${process.env.COOKIE_DOMAIN}`;
  }

  if (!request) return undefined;

  const host = request.headers.get('host') ?? '';
  const normalizedHost = host
    .replace(/:\d+$/, '')
    .toLowerCase();

  // Local development must remain host-only.
  if (
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost.endsWith('.localhost')
  ) {
    return undefined;
  }

  // Vercel preview/deployment hostnames live under the shared public suffix
  // vercel.app. Browsers must not receive Domain=.vercel.app auth cookies.
  // Keep those cookies scoped to the exact preview hostname instead.
  if (
    normalizedHost === 'vercel.app' ||
    normalizedHost.endsWith('.vercel.app')
  ) {
    return undefined;
  }

  // Conferly intentionally shares authentication across its own product
  // subdomains such as class.conferly.site and meet.conferly.site.
  if (
    normalizedHost === 'conferly.site' ||
    normalizedHost.endsWith('.conferly.site')
  ) {
    return '.conferly.site';
  }

  // Do not guess a registrable domain for unknown hosts. Simple
  // "last two labels" logic is unsafe for public suffixes such as
  // co.za/co.uk and for multi-tenant hosting providers.
  return undefined;
}

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
      async getAll() {
        // Edge middleware: use request cookies directly
        if (
          request &&
          'cookies' in request &&
          typeof (request as NextRequest).cookies?.getAll === 'function'
        ) {
          return (request as NextRequest).cookies.getAll();
        }

        // Next.js 15+: cookies() returns Promise<ReadonlyRequestCookies>
        const store = await cookies();
        
        // ReadonlyRequestCookies has getAll() method available
        return store.getAll();
      },

      async setAll(
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

        // Route Handler / Server Action case without explicit response:
        // In Next.js, cookies() without arguments sets cookies on outgoing response.
        try {
          const store = await cookies();
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