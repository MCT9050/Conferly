import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Environment variables - MUST be provided in .env or at build time
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Only create client if credentials are available
let _supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
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
}

export const supabase = _supabase;
