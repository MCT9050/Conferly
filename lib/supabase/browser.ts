// lib/supabase/browser.ts
// Client-side Supabase client using @supabase/ssr createBrowserClient.
// Automatically manages HTTP cookies via document.cookie.

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables'
  );
}

export const supabaseBrowserClient: SupabaseClient = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      autoRefreshToken: true,
    },
  }
);

export { createBrowserClient };