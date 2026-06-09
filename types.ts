export type AppView = 'dashboard' | 'lobby' | 'meeting' | 'pricing';

export type PlanTier =
  | 'trial'
  | 'classroom'
  | 'classroom_plus'
  | 'individual'
  | 'pro'
  | 'business'
  | 'enterprise'
  | 'unlimited';

/**
 * Sentinel value used in `participant_cap` to indicate an unlimited plan.
 * The participantStore treats this value as "no enforcement" and lets the
 * LiveKit room accept as many participants as it can hold.
 */
export const UNLIMITED_PARTICIPANT_CAP = 9999;

export type PlanLimits = {
  maxParticipants: number;
  maxDurationMinutes: number;
  recording: boolean;
  transcription: boolean;
  aiPulse: boolean;
  waitingRoom: boolean;
  meetingPassword: boolean;
  meetingLock: boolean;
  cloudStorage: boolean;
  customBranding: boolean;
  sso: boolean;
  analytics: boolean;
  adminDashboard: boolean;
  prioritySupport: boolean;
  storageLimitGb: number;
};

export type Subscription = {
  tier: PlanTier;
  renewalDate?: string;
  nextBilling?: string;
};

export type SubscriptionRecord = {
  id: string;
  user_id: string;
  plan: PlanTier;
  participant_cap: number;
  status: string;
  lemon_squeezy_subscription_id: string | null;
  lemon_squeezy_order_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type MeetingSecurity = {
  password: string | null;
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  waitingRoom: {
    id: string;
    name: string;
    avatar: string;
    requestedAt: Date;
  }[];
};

export type SidebarTab = 'chat' | 'participants' | 'notes' | 'transcript' | 'pulse' | 'security' | 'translate' | 'slides' | 'assistant';

export type TranscriptEntry = {
  id: string;
  speaker: string;
  text: string;
  isFinal: boolean;
  timestamp: string;
};

export type ChatMessage = {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
};

export type Participant = {
  id: string;
  name: string;
  avatar: string;
  stream: MediaStream | null;
  isSpeaking: boolean;
  isVideoOn: boolean;
  isMuted: boolean;
  audioLevel: number;
};

export type Reaction = {
  id: string;
  emoji: string;
};
