// lib/supabase.ts
// Supabase auth endpoint helpers for server-side session verification.

import { getServerEnv } from './serverEnv';

function getSupabaseConfig() {
  const env = getServerEnv();
  const baseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
  return {
    apiKey: env.SUPABASE_ANON_KEY,
    authUserUrl: `${baseUrl}/auth/v1/user`,
    authTokenUrl: `${baseUrl}/auth/v1/token`,
    authSignupUrl: `${baseUrl}/auth/v1/signup`,
  };
}

export function getSupabaseApiKey(): string {
  return getSupabaseConfig().apiKey;
}

export function getSupabaseAuthUserUrl(): string {
  return getSupabaseConfig().authUserUrl;
}

export function getSupabaseAuthTokenUrl(): string {
  return getSupabaseConfig().authTokenUrl;
}

export function getSupabaseAuthSignupUrl(): string {
  return getSupabaseConfig().authSignupUrl;
}

export function requireSupabaseConfig() {
  getServerEnv();
}
