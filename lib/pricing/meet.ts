// lib/pricing/meet.ts
// Meet product line — for Conferly Meet (conferly.site)

export const MEET_PLANS = [
  {
    id: 'meet_free',
    name: 'Free',
    description: 'For quick calls and personal use',
    monthlyPrice: 0,
    annualPrice: 0,
    maxParticipants: 3,
    maxDurationMinutes: 40,
    features: ['Screen sharing', 'Basic chat', 'No download required'],
    cta: 'Start Free',
    popular: false,
  },
  {
    id: 'meet_individual',
    name: 'Individual',
    description: 'For solo professionals and freelancers',
    monthlyPrice: 110,
    annualPrice: 88,
    maxParticipants: 10,
    maxDurationMinutes: 0, // unlimited
    features: ['Everything in Free', 'Cloud recordings', 'Transcription', 'AI Pulse'],
    cta: 'Get Started',
    popular: false,
  },
  {
    id: 'meet_pro',
    name: 'Pro',
    description: 'For small teams and growing businesses',
    monthlyPrice: 169,
    annualPrice: 135,
    maxParticipants: 50,
    maxDurationMinutes: 0,
    features: ['Everything in Individual', 'Waiting room', 'Meeting password', 'Custom branding'],
    cta: 'Upgrade to Pro',
    popular: true,
  },
  {
    id: 'meet_unlimited',
    name: 'Unlimited',
    description: 'For power users with no limits',
    monthlyPrice: 389,
    annualPrice: 311,
    maxParticipants: 0, // unlimited
    maxDurationMinutes: 0,
    features: ['Everything in Pro', 'Unlimited participants', 'Admin dashboard', 'Priority support'],
    cta: 'Go Unlimited',
    popular: false,
  },
  {
    id: 'meet_enterprise',
    name: 'Enterprise',
    description: 'For large organizations with custom needs',
    monthlyPrice: null,
    annualPrice: null,
    maxParticipants: 0,
    maxDurationMinutes: 0,
    features: ['Everything in Unlimited', 'SSO', 'Analytics', 'Dedicated support', 'SLA'],
    cta: 'Contact Sales',
    popular: false,
  },
] as const;

export type MeetPlanId = (typeof MEET_PLANS)[number]['id'];