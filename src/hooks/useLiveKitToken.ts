/**
 * LiveKit Token Hook - Fetches room access tokens from backend
 * @module useLiveKitToken
 */
import { useState, useCallback } from 'react';

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
 * Fetch LiveKit token from backend API
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
      const response = await fetch('/api/rooms/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, identity, name, isHost }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch token');
      }

      const data: TokenResponse = await response.json();
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
