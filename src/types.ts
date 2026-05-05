export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  userType: 'individual' | 'organization';
  organizationName: string | null;
  organizationSize: number | null;
  organizationIndustry: string | null;
  onboardingComplete: boolean;
}

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

export interface StoredMeeting {
  id: string;
  roomCode: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  participantCount: number;
  wasHost: boolean;
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

export interface AppState {
  // Auth
  authProfile: UserProfile | null;
  authLoading: boolean;
  authError: string | null;
  isAuthenticated: boolean;
  isOfflineMode: boolean;
  signUp: (email: string, password: string, displayName: string, turnstileToken?: string) => Promise<{ success: boolean; needsConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean }>;
  signOut: () => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
  completeOnboarding: (data: any) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean }>;
  clearAuthError: () => void;
  sessionExpired: boolean;

  // Plan
  subscription: Subscription | null;
  planLimits: PlanLimits;
  planPricing: Record<PlanTier, { monthly: number; annual: number }>;
  allPlanLimits: Record<PlanTier, PlanLimits>;
  upgradePlan: (tier: PlanTier, cycle: "monthly" | "annual") => Promise<void>;
  cancelPlan: () => Promise<void>;
  canUseFeature: (feature: keyof PlanLimits) => boolean;

  // Security
  security: MeetingSecurity;
  isHost: boolean;
  setMeetingPassword: (password: string | null) => void;
  toggleMeetingLock: () => void;
  toggleWaitingRoom: () => void;
  admitFromWaitingRoom: (participantId: string) => void;
  denyFromWaitingRoom: (participantId: string) => void;

  // Media
  devices: MediaDeviceInfo[];
  speechEnabled: boolean;
  isRecording: boolean;
  recordingTime: number;
  recordingDuration: number;
  startRecording: () => void;
  stopRecording: () => void;
  clearRecording: () => void;
  toggleRecording: () => void;

  // Meeting
  meetingSecurity: MeetingSecurity;
  participants: Participant[];
  localStream: MediaStream | null;
  meetingHistory: StoredMeeting[];
  reconnectToMeeting: (meetingId: string) => void;
  dismissReconnect: () => void;
  pendingReconnect: boolean;
  meetingsThisMonth: number;
  meetingLimitReached: boolean;
  maxMeetingsPerMonth: number;

  // UI State
  view: AppView;
  roomId: string;
  userName: string;
  chatMessages: ChatMessage[];
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  meetingDuration: number;
  reactions: Reaction[];
  handRaised: boolean;
  payment: (tier: PlanTier) => Promise<{ success: boolean; clientSecret?: string }>;
  presentation: any;
  translation: any;
}
