// lib/supabaseClient.ts
// Re-exports from the new @supabase/ssr-based browser module.
// Preserves the public API for any existing consumers.

import { supabaseBrowserClient } from './supabase/browser';
import type { Session } from '@supabase/supabase-js';

// Re-export the raw client
export const supabase = supabaseBrowserClient;

// Fix Dashboard.tsx and LandingPageClient.tsx imports
export function getSupabaseClientInstance() {
  return supabaseBrowserClient;
}

// Fix legacy getSession references
export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabaseBrowserClient.auth.getSession();
  return session;
}

// Re-export createBrowserClient + types for any other consumers
export { createBrowserClient } from './supabase/browser';
export type { SupabaseClient } from '@supabase/supabase-js';

