export type PlanTier = "free" | "pro" | "business" | "enterprise";

export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing" | "none";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  plan: PlanTier;
  subscription?: {
    tier: PlanTier;
    status: SubscriptionStatus;
    currentPeriodEnd: string;
  };
}

export interface MeetingSession {
  id: string;
  roomId: string;
  title: string;
  createdAt: string;
  createdBy: string;
  participants: string[];
  duration?: number;
  language?: string;
}

export interface RoomParticipant {
  id: string;
  identity: string;
  name: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

export interface RoomState {
  roomId: string;
  participants: RoomParticipant[];
  isRecording: boolean;
  activeSpeaker?: string;
}