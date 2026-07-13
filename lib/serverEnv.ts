// lib/serverEnv.ts
// Centralized server-only environment validation for production readiness.

export type ServerEnv = {
  NODE_ENV: 'development' | 'production' | 'test';
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  LIVEKIT_URL?: string;
  MONITORING_ENDPOINT?: string;
  MONITORING_KEY?: string;
  HUGGINGFACE_API_KEY?: string;
  LEMON_SQUEEZY_API_KEY?: string;
  LEMON_SQUEEZY_STORE_ID?: string;
  LEMON_SQUEEZY_WEBHOOK_SECRET?: string;
};

const requiredEnvKeys: Array<keyof ServerEnv> = ['NODE_ENV', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const env = process.env as Partial<Record<keyof ServerEnv, string>>;
  
  // Check for required variables - always validate at build time via direct access
  const missing = requiredEnvKeys.filter((key) => {
    const value = env[key];
    return !value || value.trim() === '';
  });
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required server environment variables: ${missing.join(', ')}. ` +
      'Check your Vercel environment settings or local .env file for deployment readiness.'
    );
  }

  cachedEnv = {
    NODE_ENV: (env.NODE_ENV ?? 'development') as ServerEnv['NODE_ENV'],
    SUPABASE_URL: env.SUPABASE_URL!,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    LIVEKIT_API_KEY: env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: env.LIVEKIT_API_SECRET,
    LIVEKIT_URL: env.LIVEKIT_URL,
    MONITORING_ENDPOINT: env.MONITORING_ENDPOINT,
    MONITORING_KEY: env.MONITORING_KEY,
    HUGGINGFACE_API_KEY: env.HUGGINGFACE_API_KEY,
    LEMON_SQUEEZY_API_KEY: env.LEMON_SQUEEZY_API_KEY,
    LEMON_SQUEEZY_STORE_ID: env.LEMON_SQUEEZY_STORE_ID,
    LEMON_SQUEEZY_WEBHOOK_SECRET: env.LEMON_SQUEEZY_WEBHOOK_SECRET,
  };

  return cachedEnv;
}

export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isTest = process.env.NODE_ENV === 'test';

export function assertProductionReady() {
  if (!isProduction) {
    throw new Error('Production readiness check must run in production environment.');
  }
}
