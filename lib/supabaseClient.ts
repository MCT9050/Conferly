// lib/supabaseClient.ts
// Lightweight wrapper that lazy-loads @supabase/supabase-js on demand.
// This file must not import '@supabase/supabase-js' at module scope so bundlers
// won't include the full SDK in the base client bundle.

import type { SupabaseClient, Session } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

async function getClient(): Promise<SupabaseClient> {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_* environment variables for client usage');

  const { createClient } = await import('@supabase/supabase-js');
  _client = createClient(url, key, {
    auth: { persistSession: true, detectSessionInUrl: false },
  });
  return _client;
}

export async function signIn(email: string, password: string) {
  const supabase = await getClient();
  // v2 API
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = await getClient();
  return supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const supabase = await getClient();
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function getSupabaseClientInstance(): Promise<SupabaseClient> {
  return getClient();
}

export default null as unknown as never;
