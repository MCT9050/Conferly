// Subscription Sync Hook
// Synchronizes subscription state across tabs and sessions using BroadcastChannel

import { useEffect, useCallback, useRef } from 'react';

export interface SubscriptionUpdate {
  tier: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const CHANNEL_NAME = 'conferly_subscription_sync';

export function useSubscriptionSync(onSubscriptionUpdate: (sub: SubscriptionUpdate) => void) {
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Listen for subscription updates from other tabs
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      if (event.data.type === 'SUBSCRIPTION_UPDATE') {
        onSubscriptionUpdate(event.data.payload);
      }
    };

    return () => {
      channel.close();
    };
  }, [onSubscriptionUpdate]);

  // Broadcast subscription update to other tabs
  const broadcastUpdate = useCallback((subscription: SubscriptionUpdate) => {
    channelRef.current?.postMessage({
      type: 'SUBSCRIPTION_UPDATE',
      payload: subscription
    });
  }, []);

  return { broadcastUpdate };
}

// Hook to refresh subscription and sync across tabs
export function useSubscriptionRefresh(
  fetchSubscription: () => Promise<SubscriptionUpdate>,
  broadcastUpdate: (sub: SubscriptionUpdate) => void
) {
  const lastFetchRef = useRef<number>(0);
  const REFRESH_INTERVAL = 60000; // 1 minute

  const refreshSubscription = useCallback(async () => {
    const now = Date.now();
    // Prevent excessive refreshes
    if (now - lastFetchRef.current < 5000) return;
    lastFetchRef.current = now;

    try {
      const subscription = await fetchSubscription();
      broadcastUpdate(subscription);
    } catch (err) {
      console.error('Failed to refresh subscription:', err);
    }
  }, [fetchSubscription, broadcastUpdate]);

  return { refreshSubscription };
}
