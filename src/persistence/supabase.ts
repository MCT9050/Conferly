import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Environment variables - MUST be provided in .env or at build time
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// VALIDATION: Force absolute URL check to prevent relative path 404s
const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

// Validate URL at initialization
if (SUPABASE_URL && !isValidUrl(SUPABASE_URL)) {
  console.error('❌ Critical: Supabase URL is invalid or relative:', SUPABASE_URL);
}

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && isValidUrl(SUPABASE_URL));

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
        // Force explicit redirect to prevent GitHub Pages 404 loop
        redirectTo: 'https://www.conferly.site/#/auth',
      },
    });
  } catch {
    _supabase = null;
  }
}

export const supabase = _supabase;
