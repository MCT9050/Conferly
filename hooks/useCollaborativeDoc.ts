"use client";

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

/**
 * Isolates y-webrtc WebrtcProvider and Yjs Doc initialization
 * Provides collaborative document instance with connection state
 * Used for real-time collaborative editing
 */
export function useCollaborativeDoc(roomId: string) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebrtcProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // Create a new Yjs document
      const ydoc = new Y.Doc();

      // Create WebRTC provider for real-time sync
      const prov = new WebrtcProvider(
        `conferly-notes-${roomId}`,
        ydoc,
        {
          maxConns: 50,
          filterBcConns: false,
        }
      );

      // Track connection state
      prov.on('synced', ({ synced }: { synced: boolean }) => {
        setIsConnected(synced);
      });

      setDoc(ydoc);
      setProvider(prov);
      setError(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to initialize collaborative document';
      setError(msg);
      setDoc(null);
      setProvider(null);
    }

    // Cleanup on unmount or roomId change
    return () => {
      if (doc) {
        doc.destroy();
      }
      if (provider) {
        provider.destroy();
      }
    };
  }, [roomId]);

  return { doc, provider, isConnected, error };
}
