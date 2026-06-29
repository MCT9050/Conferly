// lib/supabase/server.ts
// Server-side Supabase client using @supabase/ssr createServerClient.
// Context-aware: accepts optional request/response for cookie manipulation.
// Handles cookie chunking (sb-access-token.0, .1, etc.) automatically.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ClientOptions {
  request?: NextRequest | Request;
  response?: NextResponse;
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

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
       */
      setAll(
        cookiesToSet: ReadonlyArray<{
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }>
      ) {
        if (response) {
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
              store.set(name, value, options);
            });
          }
        } catch {
          // Expected in Server Components where cookie writes are forbidden.
        }
      },
    },
  });
}
