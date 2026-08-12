export type AppView = 'dashboard' | 'lobby' | 'meeting' | 'pricing';

// ── Product-scoped plan types ────────────────────────────────────────────
import type { MeetPlanId } from './lib/pricing/meet';
import type { ClassPlanId } from './lib/pricing/class';
export type { MeetPlanId, ClassPlanId };
export type PlanId = MeetPlanId | ClassPlanId;

export type ProductLine = 'meet' | 'class';

// ── Legacy PlanTier — kept for backward compatibility ────────────────────
// Deprecated: use PlanId and ProductLine instead
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
 * Mapping from new PlanId → legacy PlanTier for backward-compatible DB reads.
 */
export function planIdToLegacyTier(planId: PlanId): PlanTier {
  switch (planId) {
    case 'meet_free': return 'trial';
    case 'meet_individual': return 'individual';
    case 'meet_pro': return 'pro';
    case 'meet_unlimited': return 'unlimited';
    case 'meet_enterprise': return 'enterprise';
    case 'class_10': return 'classroom';
    case 'class_20': return 'classroom';
    case 'class_30': return 'classroom';
    case 'class_custom': return 'enterprise';
  }
}

/**
 * Mapping from legacy PlanTier → new PlanId (Meet by default).
 */
export function legacyTierToPlanId(tier: PlanTier, productLine: ProductLine = 'meet'): PlanId {
  switch (tier) {
    case 'trial': return productLine === 'class' ? 'class_10' : 'meet_free';
    case 'classroom': return 'class_10';
    case 'classroom_plus': return 'class_30';
    case 'individual': return 'meet_individual';
    case 'pro': return 'meet_pro';
    case 'business': return 'meet_pro'; // business = pro (same variant)
    case 'enterprise': return productLine === 'class' ? 'class_custom' : 'meet_enterprise';
    case 'unlimited': return productLine === 'class' ? 'class_custom' : 'meet_unlimited';
  }
}

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
  product_line: ProductLine;
  plan: string;
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

// ── Meet domain (existing — preserve) ──────────────────────────────────────
export interface MeetRoom {
  id: string;
  slug: string;
  owner_id: string;
  title: string;
}

// ── Class domain (new) ──────────────────────────────────────────────────────
export interface Classroom {
  id: string;
  slug: string;
  owner_id: string;
  title: string;
  description?: string;
  subject?: string;
  schedule: Record<string, unknown>;
  settings: Record<string, unknown>;
  enrollment_type: 'open' | 'approval' | 'invite';
  price_cents: number;
  status: 'draft' | 'scheduled' | 'live' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface ClassroomEnrollment {
  id: string;
  classroom_id: string;
  student_id: string;
  role: 'instructor' | 'ta' | 'student' | 'auditor';
  enrollment_status: 'pending' | 'active' | 'suspended' | 'completed';
  progress_percent: number;
  enrolled_at: string;
  completed_at?: string;
}

// ── Classroom seating foundation types ──────────────────────────────────────
export type ClassroomMode =
  | 'welcome'
  | 'gallery'
  | 'teacher-focus'
  | 'discussion'
  | 'screen-share'
  | 'whiteboard'
  | 'audio-only';

export type PersonalLayout =
  | 'comfortable'
  | 'standard'
  | 'compact'
  | 'paginated'
  | 'filmstrip';

export type ClassroomRole = 'owner' | 'instructor' | 'ta' | 'student' | 'auditor';

export type ParticipantDensity = 'comfortable' | 'standard' | 'compact' | 'paginated';

export type ViewportSize = 'mobile' | 'tablet' | 'desktop';

export interface ClassroomSeatingConfig {
  mode: ClassroomMode;
  personalLayout: PersonalLayout;
  density: ParticipantDensity;
  viewport: ViewportSize;
  teacherDockVisible: boolean;
  filmstripVisible: boolean;
}

export interface ClassroomParticipant {
  id: string;
  name: string;
  avatar: string;
  role: ClassroomRole;
  isSpeaking: boolean;
  isVideoOn: boolean;
  isMuted: boolean;
  audioLevel: number;
  stream: MediaStream | null;
  screenShareStream: MediaStream | null;
  isScreenSharing: boolean;
}

export interface ClassroomState {
  mode: ClassroomMode;
  personalLayout: PersonalLayout;
  density: ParticipantDensity;
  participants: ClassroomParticipant[];
  teachers: ClassroomParticipant[];
  students: ClassroomParticipant[];
  auditors: ClassroomParticipant[];
  activeScreenShare: ClassroomParticipant | null;
  localUser: ClassroomParticipant | null;
}

export interface ClassroomLesson {
  id: string;
  classroom_id: string;
  title: string;
  content: Record<string, unknown>;
  order_index: number;
  scheduled_at?: string;
  livekit_room_id?: string;
  recording_url?: string;
  status: 'scheduled' | 'live' | 'recorded' | 'cancelled';
}

export interface ClassroomAssignment {
  id: string;
  lesson_id: string;
  title: string;
  instructions?: string;
  due_at?: string;
  max_score: number;
}

export interface ClassroomSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  content: Record<string, unknown>;
  score?: number;
  submitted_at: string;
  graded_at?: string;
}