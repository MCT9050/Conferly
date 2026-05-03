export interface Participant {
  id: string;
  name: string;
  avatar: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  stream: MediaStream | null;
  audioLevel: number;
  role?: 'host' | 'cohost' | 'participant';
}

export interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
}

export interface Reaction {
  id: string;
  emoji: string;
  sender: string;
  timestamp: number;
}

// Meeting security
export interface MeetingSecurity {
  password: string | null;
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  waitingRoom: WaitingRoomEntry[];
  e2eEnabled: boolean;
  hostId: string;
}

export interface WaitingRoomEntry {
  id: string;
  name: string;
  avatar: string;
  requestedAt: Date;
}

// Subscription plans
export type PlanTier = 'trial' | 'pro' | 'business' | 'enterprise';

export interface PlanLimits {
  maxParticipants: number;
  maxDurationMinutes: number;
  maxMeetingsPerMonth: number;
  recording: boolean;
  transcription: boolean;
  aiPulse: boolean;
  customBranding: boolean;
  cloudStorage: boolean;
  storageLimitGb: number;
  sso: boolean;
  analytics: boolean;
  prioritySupport: boolean;
  adminDashboard: boolean;
  waitingRoom: boolean;
  meetingPassword: boolean;
  meetingLock: boolean;
}

export interface Subscription {
  tier: PlanTier;
  billingCycle: 'monthly' | 'annual';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export type SidebarTab = 'chat' | 'transcript' | 'notes' | 'pulse' | 'participants' | 'security' | 'translate' | 'slides';

export type AppView = 'welcome' | 'dashboard' | 'lobby' | 'meeting' | 'pricing';
