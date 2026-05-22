export type AppView = 'dashboard' | 'lobby' | 'meeting' | 'pricing';

export type PlanTier = 'trial' | 'pro' | 'business' | 'enterprise';

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

export type SidebarTab = 'chat' | 'participants' | 'notes' | 'transcript' | 'pulse' | 'security' | 'translate' | 'slides';

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
