import { useState, useCallback, useEffect } from 'react';
import type { PlanTier, PlanLimits, Subscription } from '../types';
import { isBackendConfigured, apiGetSubscription, apiUpgradeSubscription } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const PLAN_KEY = 'conferly_subscription';

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  trial: {
    maxParticipants: 10, maxDurationMinutes: 60, maxMeetingsPerMonth: 10,
    recording: true, transcription: true, aiPulse: true,
    customBranding: false, cloudStorage: false, storageLimitGb: 0,
    sso: false, analytics: false, prioritySupport: false, adminDashboard: false,
    waitingRoom: true, meetingPassword: true, meetingLock: false,
  },
  pro: {
    maxParticipants: 25, maxDurationMinutes: 480, maxMeetingsPerMonth: -1,
    recording: true, transcription: true, aiPulse: true,
    customBranding: false, cloudStorage: true, storageLimitGb: 10,
    sso: false, analytics: false, prioritySupport: false, adminDashboard: false,
    waitingRoom: true, meetingPassword: true, meetingLock: true,
  },
  business: {
    maxParticipants: 100, maxDurationMinutes: 1440, maxMeetingsPerMonth: -1,
    recording: true, transcription: true, aiPulse: true,
    customBranding: true, cloudStorage: true, storageLimitGb: 100,
    sso: true, analytics: true, prioritySupport: true, adminDashboard: true,
    waitingRoom: true, meetingPassword: true, meetingLock: true,
  },
  enterprise: {
    maxParticipants: 500, maxDurationMinutes: -1, maxMeetingsPerMonth: -1,
    recording: true, transcription: true, aiPulse: true,
    customBranding: true, cloudStorage: true, storageLimitGb: -1,
    sso: true, analytics: true, prioritySupport: true, adminDashboard: true,
    waitingRoom: true, meetingPassword: true, meetingLock: true,
  },
};

const PLAN_PRICING: Record<PlanTier, { monthly: number; annual: number }> = {
  trial: { monthly: 0, annual: 0 },
  pro: { monthly: 12, annual: 9 },
  business: { monthly: 25, annual: 20 },
  enterprise: { monthly: -1, annual: -1 },
};

function loadLocal(): Subscription {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { tier: 'trial', billingCycle: 'monthly', currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), cancelAtPeriodEnd: false };
}

function saveLocal(sub: Subscription) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(sub));
}

export function usePlan() {
  const [subscription, setSubscription] = useState<Subscription>(() => loadLocal());

  // Sync plan from server on mount
  useEffect(() => {
    (async () => {
      // Try Supabase first
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data } = await supabase.from('profiles').select('plan_tier, billing_cycle, plan_period_end').eq('id', user.id).single();
            if (data) {
              const s: Subscription = {
                tier: (data.plan_tier || 'trial') as PlanTier,
                billingCycle: (data.billing_cycle || 'monthly') as 'monthly' | 'annual',
                currentPeriodEnd: data.plan_period_end, cancelAtPeriodEnd: false,
              };
              setSubscription(s); saveLocal(s);
              return;
            }
          }
        } catch { /* fall through */ }
      }
      // Try self-hosted backend
      if (isBackendConfigured) {
        try {
          const sub = await apiGetSubscription();
          const s: Subscription = { tier: sub.tier as PlanTier, billingCycle: sub.billingCycle as 'monthly' | 'annual', currentPeriodEnd: sub.currentPeriodEnd, cancelAtPeriodEnd: sub.cancelAtPeriodEnd };
          setSubscription(s); saveLocal(s);
        } catch { /* use cached */ }
      }
    })();
  }, []);

  const limits = PLAN_LIMITS[subscription.tier];

  const upgradeTo = useCallback(async (tier: PlanTier, cycle: 'monthly' | 'annual') => {
    const newSub: Subscription = {
      tier, billingCycle: cycle,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
    };

    // Save locally immediately
    setSubscription(newSub);
    saveLocal(newSub);

    // Sync to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({
            plan_tier: tier, billing_cycle: cycle,
            plan_period_end: newSub.currentPeriodEnd, updated_at: new Date().toISOString(),
          }).eq('id', user.id);
          // Record payment
          const price = PLAN_PRICING[tier];
          const amount = cycle === 'annual' ? price.annual : price.monthly;
          if (amount > 0) {
            await supabase.from('payments').insert({
              user_id: user.id, plan_tier: tier, billing_cycle: cycle, amount_zar: amount, currency: 'ZAR', status: 'completed',
            });
          }
        }
      } catch { /* silent */ }
    }

    // Sync to self-hosted backend
    if (isBackendConfigured) {
      const price = PLAN_PRICING[tier];
      const amount = cycle === 'annual' ? price.annual : price.monthly;
      try {
        await apiUpgradeSubscription(tier, cycle, amount > 0 ? amount : undefined);
      } catch { /* silent */ }
    }
  }, []);

  const cancelSubscription = useCallback(() => {
    const updated = { ...subscription, cancelAtPeriodEnd: true };
    setSubscription(updated);
    saveLocal(updated);
  }, [subscription]);

  const canUseFeature = useCallback((feature: keyof PlanLimits): boolean => {
    const val = limits[feature];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    return true;
  }, [limits]);

  const isWithinParticipantLimit = useCallback((count: number): boolean => {
    return count <= limits.maxParticipants;
  }, [limits]);

  const isWithinDurationLimit = useCallback((minutes: number): boolean => {
    if (limits.maxDurationMinutes === -1) return true;
    return minutes <= limits.maxDurationMinutes;
  }, [limits]);

  return {
    subscription, limits,
    pricing: PLAN_PRICING, allLimits: PLAN_LIMITS,
    upgradeTo, cancelSubscription,
    canUseFeature, isWithinParticipantLimit, isWithinDurationLimit,
  };
}
