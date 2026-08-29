// lib/freeTierAccounting.ts
// Phase C integration helpers (Universal Registered Free Tier).
//
// This module is the glue between the EXISTING authoritative lifecycles
// (meeting termination, lesson termination) and the Phase B database layer
// (lib/freeTier.ts -> consume_free_usage / get_free_usage_status).
//
// Responsibilities are deliberately narrow:
//   - convert authoritative elapsed seconds into the Phase B contract unit
//     (integer minutes; the RPC refuses values below 1),
//   - record usage on behalf of the charged user via the service-role path,
//   - map get_free_usage_status results into the access decision vocabulary
//     (paid / free available / free exhausted / registration required).
//
// It NEVER decides meeting/classroom authorization and NEVER computes
// remaining allowances in TypeScript - the database RPC owns all enforcement.

import {
  consumeFreeUsage,
  type FreeTierProductLine,
  type FreeTierStatus,
} from './freeTier';
import { getSupabaseServerClient } from './supabaseServerClient';

export type FreeTierAccountingOutcome = {
  /** Usage was recorded in the free-tier ledger (or the user is paid - nothing to record). */
  recorded: boolean;
  /** Nothing to do: fewer than 1 full minute elapsed, or paid entitlement. */
  skipped: boolean;
  /** The accounting RPC failed. Callers must log this - a failed accounting
   *  operation must never be interpreted as a denial or as free success. */
  error: boolean;
  detail?: string;
};

/**
 * Convert authoritative elapsed seconds into Phase B contract minutes.
 * The RPC takes an INTEGER number of minutes and refuses values below 1, so
 * only fully elapsed minutes are reported (never more than actually used).
 */
export function minutesFromSeconds(durationSeconds: number | null | undefined): number {
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) {
    return 0;
  }
  return Math.floor(durationSeconds / 60);
}

/**
 * Record actual free-tier usage for a user from an authoritative lifecycle
 * duration. Runs as service_role (lifecycle accounting), so the caller may
 * report usage for the meeting/lesson owner rather than the acting session.
 */
export async function recordFreeUsage(
  userId: string,
  productLine: FreeTierProductLine,
  durationSeconds: number | null | undefined,
  occurredAt: Date = new Date()
): Promise<FreeTierAccountingOutcome> {
  const minutes = minutesFromSeconds(durationSeconds);
  if (minutes < 1) {
    return { recorded: false, skipped: true, error: false, detail: 'no full minute elapsed' };
  }

  const result = await consumeFreeUsage(userId, productLine, minutes, occurredAt);
  if (!result) {
    return {
      recorded: false,
      skipped: false,
      error: true,
      detail: 'consume_free_usage RPC failed',
    };
  }
  if (result.paid) {
    return { recorded: false, skipped: true, error: false, detail: 'paid entitlement' };
  }
  if (!result.consumed) {
    return {
      recorded: false,
      skipped: true,
      error: false,
      detail: result.reason ?? 'usage not recorded by free-tier RPC',
    };
  }
  return {
    recorded: true,
    skipped: false,
    error: false,
    detail: `recorded ${result.consumptionMinutes ?? minutes} minute(s)`,
  };
}

/**
 * Resolve the elapsed lifetime (seconds) of a LiveKit room — the
 * server-authoritative runtime source for a class lesson, whose
 * `classroom_lessons` row carries no start/end timestamps. Returns null when
 * the room cannot be resolved (e.g. already finished and reaped, or LiveKit
 * misconfigured); callers treat null as "no authoritative usage" so the
 * LiveKit room_finished webhook (which carries creationTime in-band) remains
 * the accounting authority.
 */
export async function getLiveRoomElapsedSeconds(roomName: string): Promise<number | null> {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret || !roomName) {
    return null;
  }

  try {
    const { RoomServiceClient } = await import('livekit-server-sdk');
    const client = new RoomServiceClient(url, apiKey, apiSecret);
    const rooms = await client.listRooms([roomName]);
    const room = rooms.find((r) => r.name === roomName);
    if (!room) {
      return null;
    }
    // Room.creationTime is uint64 epoch seconds (bigint in the protobuf JS).
    const createdSeconds = Number(room.creationTime);
    if (!Number.isFinite(createdSeconds) || createdSeconds <= 0) {
      return null;
    }
    const elapsedSeconds = Math.floor(Date.now() / 1000) - createdSeconds;
    return elapsedSeconds > 0 ? elapsedSeconds : 0;
  } catch {
    // Lookup failure must never fabricate or block termination accounting;
    // the webhook room_finished path remains authoritative.
    return null;
  }
}

export type FreeTierStartDecision = {
  allow: boolean;
  httpStatus: number;
  code:
    | 'ok'
    | 'free_tier_exhausted'
    | 'free_tier_registration_required'
    | 'free_tier_status_unavailable'
    | 'free_tier_invalid_product';
  message: string;
};

/**
 * Map a caller-scoped get_free_usage_status result into the start-access
 * decision vocabulary. The status is computed by the database (UTC usage
 * days, eligible-day counting, paid precedence) - never by the browser.
 */
export function freeTierStartDecision(
  status: FreeTierStatus | null
): FreeTierStartDecision {
  if (!status) {
    // The status RPC failed. Per the integration contract this must NOT be
    // interpreted as free access allowed or as paid access.
    return {
      allow: false,
      httpStatus: 503,
      code: 'free_tier_status_unavailable',
      message: 'Unable to verify your access right now. Please try again.',
    };
  }
  if (status.status === 'paid') {
    return { allow: true, httpStatus: 200, code: 'ok', message: 'Paid entitlement active.' };
  }
  if (status.status === 'anonymous') {
    return {
      allow: false,
      httpStatus: 401,
      code: 'free_tier_registration_required',
      message: 'Please register or sign in to use Conferly.',
    };
  }
  if (status.status === 'invalid') {
    return {
      allow: false,
      httpStatus: 500,
      code: 'free_tier_invalid_product',
      message: 'This product is not available for your account.',
    };
  }
  // status === 'free'
  if (status.freeAccess && !status.exhausted && (status.minutesRemainingToday ?? 0) > 0) {
    return { allow: true, httpStatus: 200, code: 'ok', message: 'Free access available.' };
  }
  return {
    allow: false,
    httpStatus: 403,
    code: 'free_tier_exhausted',
    message: 'Your free time for this product is used up. Upgrade to continue.',
  };
}

/**
 * Resolve the owner (charged party) of a meeting for lifecycle accounting.
 * Returns null when the meeting cannot be resolved; callers skip accounting
 * rather than guessing an identity.
 */
export async function resolveMeetingOwnerId(meetingId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('meetings')
    .select('owner')
    .eq('id', meetingId)
    .maybeSingle();
  const owner = (data as { owner?: string | null } | null)?.owner;
  return typeof owner === 'string' && owner.length > 0 ? owner : null;
}

/**
 * Resolve the classroom and its owner for a lesson. The classroom OWNER is the
 * charged party for Class free-tier usage — the same party whose subscription
 * keys live capacity — per the Phase B contract.
 */
export async function resolveLessonClassContext(
  lessonId: string
): Promise<{ classroomId: string | null; ownerId: string | null }> {
  const supabase = getSupabaseServerClient();
  const { data: lesson } = await supabase
    .from('classroom_lessons')
    .select('classroom_id')
    .eq('id', lessonId)
    .maybeSingle();
  const classroomId = (lesson as { classroom_id?: string | null } | null)?.classroom_id ?? null;
  if (!classroomId) {
    return { classroomId: null, ownerId: null };
  }
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('owner_id')
    .eq('id', classroomId)
    .maybeSingle();
  const ownerId = (classroom as { owner_id?: string | null } | null)?.owner_id ?? null;
  return { classroomId, ownerId };
}

/**
 * Elapsed seconds of a finished LiveKit room from its in-band webhook payload:
 * Room.creationTime (uint64 epoch seconds) against the event termination time.
 * Returns null when creationTime is missing/unparseable (no usage is guessed).
 */
export function elapsedSecondsFromCreationTime(
  creationTime: unknown,
  endEpochSeconds: number
): number | null {
  const created = Number(creationTime);
  if (!Number.isFinite(created) || created <= 0) {
    return null;
  }
  const elapsed = Math.floor(endEpochSeconds) - created;
  return elapsed > 0 ? elapsed : 0;
}
