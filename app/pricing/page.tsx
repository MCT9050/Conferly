"use client";

import type { PlanTier, PlanLimits } from '../../types';
import PricingPage from '../../components/PricingPage';

// Pricing data for all tiers
const PRICING: Record<PlanTier, { monthly: number; annual: number }> = {
  trial: { monthly: 0, annual: 0 },
  classroom: { monthly: 89, annual: 71 },
  classroom_plus: { monthly: 220, annual: 176 },
  individual: { monthly: 110, annual: 88 },
  pro: { monthly: 149, annual: 119 },
  business: { monthly: 249, annual: 199 },
  enterprise: { monthly: -1, annual: -1 },
  unlimited: { monthly: 389, annual: 311 },
};

const ALL_LIMITS: Record<PlanTier, PlanLimits> = {
  trial: {
    maxParticipants: 2,
    maxDurationMinutes: 40,
    recording: false,
    transcription: true,
    aiPulse: true,
    waitingRoom: false,
    meetingPassword: true,
    meetingLock: false,
    cloudStorage: false,
    customBranding: false,
    sso: false,
    analytics: false,
    adminDashboard: false,
    prioritySupport: false,
    storageLimitGb: 0,
  },
  classroom: {
    maxParticipants: 5,
    maxDurationMinutes: 120,
    recording: true,
    transcription: true,
    aiPulse: true,
    waitingRoom: true,
    meetingPassword: true,
    meetingLock: true,
    cloudStorage: true,
    customBranding: false,
    sso: false,
    analytics: true,
    adminDashboard: false,
    prioritySupport: false,
    storageLimitGb: 5,
  },
  classroom_plus: {
    maxParticipants: 30,
    maxDurationMinutes: 240,
    recording: true,
    transcription: true,
    aiPulse: true,
    waitingRoom: true,
    meetingPassword: true,
    meetingLock: true,
    cloudStorage: true,
    customBranding: false,
    sso: false,
    analytics: true,
    adminDashboard: false,
    prioritySupport: true,
    storageLimitGb: 20,
  },
  individual: {
    maxParticipants: 10,
    maxDurationMinutes: 120,
    recording: true,
    transcription: true,
    aiPulse: true,
    waitingRoom: false,
    meetingPassword: true,
    meetingLock: true,
    cloudStorage: true,
    customBranding: false,
    sso: false,
    analytics: false,
    adminDashboard: false,
    prioritySupport: false,
    storageLimitGb: 5,
  },
  pro: {
    maxParticipants: 50,
    maxDurationMinutes: 480,
    recording: true,
    transcription: true,
    aiPulse: true,
    waitingRoom: true,
    meetingPassword: true,
    meetingLock: true,
    cloudStorage: true,
    customBranding: true,
    sso: false,
    analytics: true,
    adminDashboard: true,
    prioritySupport: true,
    storageLimitGb: 50,
  },
  business: {
    maxParticipants: 200,
    maxDurationMinutes: 480,
    recording: true,
    transcription: true,
    aiPulse: true,
    waitingRoom: true,
    meetingPassword: true,
    meetingLock: true,
    cloudStorage: true,
    customBranding: true,
    sso: true,
    analytics: true,
    adminDashboard: true,
    prioritySupport: true,
    storageLimitGb: 200,
  },
  enterprise: {
    maxParticipants: 500,
    maxDurationMinutes: 480,
    recording: true,
    transcription: true,
    aiPulse: true,
    waitingRoom: true,
    meetingPassword: true,
    meetingLock: true,
    cloudStorage: true,
    customBranding: true,
    sso: true,
    analytics: true,
    adminDashboard: true,
    prioritySupport: true,
    storageLimitGb: 1000,
  },
  unlimited: {
    maxParticipants: 500,
    maxDurationMinutes: -1,
    recording: true,
    transcription: true,
    aiPulse: true,
    waitingRoom: true,
    meetingPassword: true,
    meetingLock: true,
    cloudStorage: true,
    customBranding: true,
    sso: true,
    analytics: true,
    adminDashboard: true,
    prioritySupport: true,
    storageLimitGb: -1,
  },
};

function getSubscription() {
  return {
    tier: 'trial' as PlanTier,
    renewalDate: undefined,
    nextBilling: undefined,
  };
}

export default function PricingRoute() {
  const subscription = getSubscription();

  return (
    <PricingPage
      setView={(v) => {
        if (v === 'dashboard') {
          window.location.href = '/dashboard';
        }
      }}
      subscription={subscription}
      pricing={PRICING}
      allLimits={ALL_LIMITS}
      onUpgrade={async (tier, _cycle) => {
        if (tier === 'classroom') {
          const { createClassroomCheckout } = await import('../actions/checkout-actions');
          const result = await createClassroomCheckout();
          if (result.url) window.location.href = result.url;
        } else if (tier === 'pro') {
          const { createProCheckout } = await import('../actions/checkout-actions');
          const result = await createProCheckout();
          if (result.url) window.location.href = result.url;
        } else {
          window.location.href = '/dashboard';
        }
      }}
    />
  );
}