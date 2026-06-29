// lib/supabaseServerClient.ts
// Service-role elevated Supabase client for server-side database operations.
// This client uses the service_role key for privileged access (verifyRoomAccess, etc.)
// and bypasses RLS. No cookie session handling needed since it uses the service role.
// Context-aware only for backward compatibility -- cookies are effectively unused here.

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from './serverEnv';

export function getSupabaseServerClient(): SupabaseClient {
  const env = getServerEnv();
  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.POSTGRES_CONFERLY_SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY or POSTGRES_CONFERLY_SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL environment variable');
  }

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