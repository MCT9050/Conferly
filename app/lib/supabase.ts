import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return mock for dev mode - will not persist but won't crash
    console.warn("Supabase not configured - running in demo mode");
    return null as unknown as SupabaseClient;
  }
  
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return _supabase;
}

// Re-export specific auth methods to avoid initializing at build time
// Returns null when not configured - caller must handle gracefully
const noopAuth = {
  getSession: async () => ({ data: { session: null }, error: null }),
  getUser: async () => ({ data: { user: null }, error: null }),
  signUp: async () => ({ data: { user: null, session: null }, error: null }),
  signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error("Supabase not configured") }),
  signOut: async () => ({ error: null }),
  resetPasswordForEmail: async () => ({ data: null, error: new Error("Supabase not configured") }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, unsubscribe: () => {} }),
  get user() { return null; },
};

export const supabase = {
  get auth() {
    const client = getSupabaseClient();
    return client?.auth || noopAuth;
  },
  getSession: async () => {
    const client = getSupabaseClient();
    if (!client) return { data: { session: null }, error: null };
    return client.auth.getSession();
  },
  getUser: async () => {
    const client = getSupabaseClient();
    if (!client) return { data: { user: null }, error: null };
    return client.auth.getUser();
  },
  signUp: async (options: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
    const client = getSupabaseClient();
    if (!client) return { data: { user: null, session: null }, error: null };
    return client.auth.signUp(options);
  },
  signInWithPassword: async (options: { email: string; password: string }) => {
    const client = getSupabaseClient();
    if (!client) return { data: { user: null, session: null }, error: new Error("Supabase not configured") };
    return client.auth.signInWithPassword(options);
  },
  signOut: async () => {
    const client = getSupabaseClient();
    if (!client) return { error: null };
    return client.auth.signOut();
  },
  resetPasswordForEmail: async (email: string, options?: { redirectTo?: string }) => {
    const client = getSupabaseClient();
    if (!client) return { data: null, error: new Error("Supabase not configured") };
    return client.auth.resetPasswordForEmail(email, options);
  },
  onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
    const client = getSupabaseClient();
    if (!client) return { data: { subscription: { unsubscribe: () => {} } }, unsubscribe: () => {} };
    return client.auth.onAuthStateChange(callback);
  },
};