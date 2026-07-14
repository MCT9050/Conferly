// lib/supabaseServerClient.ts
// Service-role elevated Supabase client for server-side database operations.
// This client uses the service_role key for privileged access (verifyRoomAccess, etc.)
// and bypasses RLS. No cookie session handling needed since it uses the service role.
// Context-aware only for backward compatibility -- cookies are effectively unused here.

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from './serverEnv';

// Request tracing for debugging
const TRACE_ENABLED = process.env.NODE_ENV === 'development' || process.env.AUTH_TRACE === 'true';

function traceDb(step: string, detail: string, data?: Record<string, unknown>): void {
  if (TRACE_ENABLED) {
    console.log(`[DB_TRACE] [${new Date().toISOString()}] ${step}: ${detail}`, data ? JSON.stringify(data) : '');
  }
}

export function getSupabaseServerClient(): SupabaseClient {
  traceDb('getSupabaseServerClient-start', 'Creating service-role Supabase client');
  
  const env = getServerEnv();
  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.POSTGRES_CONFERLY_SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    const errorMsg = 'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY or POSTGRES_CONFERLY_SUPABASE_SERVICE_ROLE_KEY';
    traceDb('getSupabaseServerClient-error', errorMsg, {
      hasServiceRoleKey: !!serviceRoleKey,
      envKeys: Object.keys(env).filter(k => k.includes('SUPABASE')),
    });
    throw new Error(errorMsg);
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    const errorMsg = 'Missing SUPABASE_URL environment variable';
    traceDb('getSupabaseServerClient-error', errorMsg, {
      hasSupabaseUrl: !!supabaseUrl,
      envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')),
    });
    throw new Error(errorMsg);
  }
  
  traceDb('getSupabaseServerClient-success', `Created client for ${supabaseUrl}`);

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll() {
        // Service role client does not need request cookies;
        // this is a no-op for elevated DB operations.
        return [];
      },
      setAll() {
        // Service role client does not need to set cookies;
        // this is a no-op for elevated DB operations.
      },
    },
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
  });
}