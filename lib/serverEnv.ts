// lib/serverEnv.ts
// Centralized server-only environment validation for production readiness.

export type ServerEnv = {
  NODE_ENV: 'development' | 'production' | 'test';
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  MONITORING_ENDPOINT?: string;
  MONITORING_KEY?: string;
};

const requiredEnvKeys: Array<keyof ServerEnv> = ['NODE_ENV', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const env = process.env as Partial<Record<keyof ServerEnv, string>>;
  const missing = requiredEnvKeys.filter((key) => !env[key]);
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
    MONITORING_ENDPOINT: env.MONITORING_ENDPOINT,
    MONITORING_KEY: env.MONITORING_KEY,
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
