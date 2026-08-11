// lib/meetEntitlements.ts
// Centralized Meet feature entitlement decisions.

import { verifyRoomAccess } from './meetingAuth';
import { getSupabaseServerClient } from './supabaseServerClient';

export type MeetFeature =
  | 'recording'
  | 'transcription'
  | 'ai_assistant'
  | 'ai_summary';

export type MeetFeatureDecision = {
  allowed: boolean;
  reason: 'allowed' | 'missing_context' | 'room_access_denied' | 'meet_entitlement_required';
  meetingId?: string;
  plan?: string;
};

const ACTIVE_STATUSES = new Set(['active', 'trialing']);
const PAID_MEET_PLANS = new Set([
  'meet_individual',
  'meet_pro',
  'meet_unlimited',
  'meet_enterprise',
  // Legacy Meet tiers only. Class legacy tiers are intentionally excluded.
  'individual',
  'pro',
  'business',
  'unlimited',
  'enterprise',
]);

/**
 * Server-authoritative Meet premium feature decision.
 *
 * Resource access and product entitlement are deliberately separate:
 * 1. verify the caller can access the Meet room;
 * 2. resolve only the caller's Meet subscription;
 * 3. map the Meet entitlement to the requested feature capability.
 */
export async function canUseMeetFeature(
  userId: string,
  roomId: string | undefined,
  feature: MeetFeature,
): Promise<MeetFeatureDecision> {
  const normalizedRoomId = roomId?.trim();
  if (!normalizedRoomId) {
    return { allowed: false, reason: 'missing_context' };
  }

  const roomAccess = await verifyRoomAccess(userId, normalizedRoomId);
  if (!roomAccess) {
    return { allowed: false, reason: 'room_access_denied' };
  }

  if (!isMeetPremiumFeature(feature)) {
    return { allowed: true, reason: 'allowed', meetingId: roomAccess.meetingId };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .eq('product_line', 'meet')
    .maybeSingle();

  if (error || !data) {
    return {
      allowed: false,
      reason: 'meet_entitlement_required',
      meetingId: roomAccess.meetingId,
    };
  }

  const plan = String(data.plan);
  const status = String(data.status);
  const allowed = ACTIVE_STATUSES.has(status) && PAID_MEET_PLANS.has(plan);

  return {
    allowed,
    reason: allowed ? 'allowed' : 'meet_entitlement_required',
    meetingId: roomAccess.meetingId,
    plan,
  };
}

export function isMeetPremiumFeature(feature: MeetFeature): boolean {
  return (
    feature === 'recording' ||
    feature === 'transcription' ||
    feature === 'ai_assistant' ||
    feature === 'ai_summary'
  );
}