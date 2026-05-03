import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Conferly — Supabase Project: neymqmyzmsberwlowlpw
const SUPABASE_URL = 'https://neymqmyzmsberwlowlpw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5leW1xbXl6bXNiZXJ3bG93bHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDY3OTcsImV4cCI6MjA5MzE4Mjc5N30.2tYikfedPC245ycevkGjQLbWdYn_rHrOj8fd2ISL8C4';

export const isSupabaseConfigured = true;

let _supabase: SupabaseClient | null = null;

try {
  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'conferly_supabase_auth',
    },
  });
} catch {
  _supabase = null;
}

export const supabase = _supabase;
