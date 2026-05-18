/**
 * Environment Validation Utilities
 * 
 * Validates required environment variables at startup.
 * Used by both client and server components.
 */

export interface EnvConfig {
  client: {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    NEXT_PUBLIC_LIVEKIT_URL?: string;
  };
  server: {
    SUPABASE_SERVICE_ROLE_KEY?: string;
    LIVEKIT_API_KEY?: string;
    LIVEKIT_API_SECRET?: string;
  };
}

/**
 * Validate required environment variables
 * Throws error if critical variables are missing
 */
export function validateEnv(): void {
  const missing: string[] = [];
  
  // Client-side required variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    // Don't throw in development - allow demo mode
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Check if LiveKit is configured
 */
export function isLiveKitConfigured(): boolean {
  return !!(
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET &&
    process.env.NEXT_PUBLIC_LIVEKIT_URL
  );
}

/**
 * Get environment info for debugging (safe to expose)
 */
export function getEnvInfo(): { supabase: boolean; livekit: boolean; nodeEnv: string } {
  return {
    supabase: isSupabaseConfigured(),
    livekit: isLiveKitConfigured(),
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}
