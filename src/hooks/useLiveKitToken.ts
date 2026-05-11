/**
 * LiveKit Token Hook - Fetches room access tokens from Supabase Edge Function
 * @module useLiveKitToken
 */
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface TokenResponse {
  token: string;
  url: string;
}

interface UseLiveKitTokenReturn {
  token: string | null;
  url: string | null;
  isLoading: boolean;
  error: string | null;
  fetchToken: (roomId: string, identity: string, name?: string, isHost?: boolean) => Promise<void>;
}

/**
 * Fetch LiveKit token via Supabase Edge Function
 */
export function useLiveKitToken(): UseLiveKitTokenReturn {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async (
    roomId: string,
    identity: string,
    name?: string,
    isHost?: boolean
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-livekit-token', {
        body: { roomId, identity, name, isHost },
      });

      if (fnError || !data) {
        throw new Error(fnError?.message || 'Failed to invoke function');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setToken(data.token);
      setUrl(data.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[LiveKitToken] Failed to fetch:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { token, url, isLoading, error, fetchToken };
}
