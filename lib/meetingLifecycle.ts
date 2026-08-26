// lib/meetingLifecycle.ts
// P4-2b shared authority for meeting termination.
// Both the LiveKit webhook receiver and the host end-action call this helper,
// which in turn calls the service-role RPC complete_meeting_atomic(). This
// keeps a single persistence path so webhooks and host actions can never
// diverge or race into conflicting state.

import { getSupabaseServerClient } from './supabaseServerClient';

export type MeetingTerminationResult = {
  ok: boolean;
  reason?: string;
  meeting_id?: string;
  status?: string;
  already_ended?: boolean;
  ended_at?: string | null;
  duration_seconds?: number | null;
};

type RpcResult = {
  ok: boolean;
  reason?: string;
  meeting_id?: string;
  status?: string;
  already_ended?: boolean;
  ended_at?: string | null;
  duration_seconds?: number | null;
};

/**
 * Mark a meeting completed via the authoritative, idempotent RPC.
 * `endedAtISO` must be a parseable ISO timestamp (LiveKit webhook event
 * timestamp or current time for the host fallback).
 */
export async function completeMeeting(
  meetingId: string,
  endedAtISO: string
): Promise<MeetingTerminationResult> {
  const ts = new Date(endedAtISO).getTime();
  if (Number.isNaN(ts)) {
    return { ok: false, reason: 'invalid ended_at timestamp' };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc('complete_meeting_atomic', {
    p_meeting_id: meetingId,
    p_ended_at: endedAtISO,
  });

  if (error) {
    return { ok: false, reason: error.message ?? 'termination failed' };
  }

  const r = (data as unknown) as RpcResult | null;
  if (!r || typeof r.ok !== 'boolean') {
    return { ok: false, reason: 'unexpected termination response' };
  }

  return {
    ok: r.ok,
    reason: r.reason,
    meeting_id: r.meeting_id,
    status: r.status,
    already_ended: r.already_ended,
    ended_at: r.ended_at,
    duration_seconds: r.duration_seconds,
  };
}
