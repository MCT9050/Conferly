/**
 * Unified Type Definitions for Conferly
 * Consolidates all interface types across the application.
 */

/**
 * User types - unified from SupabaseUser and ApiUser
 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  emailVerified: boolean;
  termsAccepted: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Subscription types - unified across all contexts
 */
export type PlanTier = 'trial' | 'pro' | 'business' | 'enterprise';
export type PlanLimits = {
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
};

export interface Subscription {
  tier: PlanTier;
  billingCycle: 'monthly' | 'annual';
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

/**
 * Meeting types
 */
export interface Meeting {
  id: string;
  roomCode: string;
  title?: string;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds: number;
  participantCount: number;
  userId?: string;
}

/**
 * Meeting notes with version control for collaboration
 */
export interface MeetingNotes {
  meetingId: string;
  content: string;
  version: number;
  updatedAt: string;
  userId?: string;
}

/**
 * Chat message types
 */
export interface ChatMessage {
  id: string;
  meetingId: string;
  userId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

/**
 * Analytics event types
 */
export type AnalyticsEventType = 
  | 'meeting.started'
  | 'meeting.ended'
  | 'meeting.joined'
  | 'subscription.upgraded'
  | 'page.view'
  | 'error.occurred';

export interface AnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * API Response types
 */
export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  code: string;
  message?: string;
  data?: T;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Auth types
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthState {
  user: User | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Error boundary types
 */
export interface ErrorInfo {
  componentStack?: string;
  error: Error;
  timestamp: string;
  userId?: string;
  sessionId?: string;
}
