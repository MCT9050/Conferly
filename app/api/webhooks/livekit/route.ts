// app/api/webhooks/livekit/route.ts
// P4-2b: LiveKit webhook receiver — the authoritative source for meeting
// termination. Uses the signature-verifying WebhookReceiver from
// livekit-server-sdk@^2.15.3 (dependency already present).
//
// Scope is intentionally narrow (per the Phase 4 approval):
//   - room_finished (meet)  → complete_meeting_atomic (status='completed',
//     ended_at, duration_seconds when unambiguously derivable).
//   - room_finished (class) → end_class_lesson_atomic reconciliation.
//   - Everything else is acknowledged and skipped.
//
// participant_count is deliberately LEFT UNCHANGED this phase: the existing
// schema/application carries no established contract for whether it means
// current participants, unique joiners, or max-concurrent, so writing it would
// invent semantics. This is documented as deferred to a later phase.
//
// The endpoint is the SINGLE persistence authority: the host end-action
// (POST /api/meetings/[id]/end) calls the same helper/RPC.

import { NextRequest, NextResponse } from 'next/server';
import { completeMeeting } from '@/lib/meetingLifecycle';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import {
  elapsedSecondsFromCreationTime,
  recordFreeUsage,
  resolveLessonClassContext,
  resolveMeetingOwnerId,
} from '@/lib/freeTierAccounting';

// LiveKit webhook auth: livekit-server-sdk WebhookReceiver.receive() compares
// the body against the `Authorization` header (LiveKit sends the bearer token
// there). Any missing/invalid header → 401.


// WebhookReceiver is exported as a value from livekit-server-sdk.
// Imported lazily so the module can be required at the edge if needed.
async function getReceiver() {
  // Dynamic require to avoid bundling the verifier on unrelated entrypoints.
  const mod = await import('livekit-server-sdk');
  return mod.WebhookReceiver as unknown as {
    new (
      apiKey: string,
      apiSecret: string
    ): { receive: (body: string, authHeader?: string) => Promise<any> };
  };
}

export async function POST(request: NextRequest) {
  // LiveKit webhook targets are unauthenticated endpoints by design;
  // authenticity is proven by the HMAC/signature verification below. We still
  // surface config problems loudly rather than silently accepting payloads.
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'LiveKit credentials are not configured on the server.' },
      { status: 500 }
    );
  }

    const body = await request.text();
  const authHeader = request.headers.get('Authorization') ?? '';


  let event: any;
  try {
    const Receiver = await getReceiver();
    const receiver = new Receiver(apiKey, apiSecret);
    event = await receiver.receive(body, authHeader);
  } catch {
    return NextResponse.json({ error: 'Invalid LiveKit signature' }, { status: 401 });
  }

  const eventName: string = event?.event ?? '';
  const roomName: string | undefined = event?.room?.name;

  // Only room_finished carries authoritative termination semantics.
  if (eventName !== 'room_finished') {
    return NextResponse.json({ received: true, skipped: true });
  }
  if (!roomName) {
    return NextResponse.json({ received: true, skipped: true });
  }

  // Authoritative termination time from the event payload if present;
  // fall back to now() (server-received time) rather than guessing.
  let endedAtISO: string;
  const rawTs = (event as any)?.createdAt;
  if (typeof rawTs === 'number' && rawTs > 0) {
    endedAtISO = new Date(rawTs * 1000).toISOString();
  } else {
    endedAtISO = new Date().toISOString();
  }

  const supabase = getSupabaseServerClient();
  let result: {
    ok: boolean;
    reason?: string;
    already_ended?: boolean;
    duration_seconds?: number | null;
  } = { ok: true };

  try {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomName)) {
      // Meet: room name is the meeting.id (uuid).
      result = await completeMeeting(roomName, endedAtISO);
      // Phase C: free-tier accounting. The authoritative duration is
      // complete_meeting_atomic's duration_seconds. First-wins: the RPC's
      // already_ended flag guarantees that retried/replayed room_finished
      // events and the host end-action can never double-charge.
      if (result.ok && !result.already_ended && (result.duration_seconds ?? 0) > 0) {
        const ownerId = await resolveMeetingOwnerId(roomName);
        if (ownerId) {
          const accounting = await recordFreeUsage(
            ownerId,
            'meet',
            result.duration_seconds,
            new Date(endedAtISO)
          );
          if (accounting.error) {
            console.error('[LiveKitWebhook] Meet free-tier accounting failed:', accounting.detail);
          }
        }
      }
    } else {
      // Class: room name is deterministic 'class-<classroomId>-<lessonId>'.
      const match = /^class-([0-9a-f-]{36})-([0-9a-f-]{36})$/i.exec(roomName);
      if (match) {
        const lessonId = match[2];
        const { data: rpcResult, error } = await supabase.rpc(
          'end_class_lesson_atomic',
          { p_lesson_id: lessonId }
        );
        if (error) {
          // Already-idempotent RPC: a live->completed flip that loses the race
          // is fine; surface only genuine failures.
          result = { ok: false, reason: (rpcResult as any)?.reason ?? error.message };
        } else {
          result = {
            ok: (rpcResult as any)?.ok ?? false,
            reason: (rpcResult as any)?.reason,
            already_ended: (rpcResult as any)?.already_completed,
          };
          // Phase C: free-tier accounting for Class — charged against the
          // classroom OWNER (the same party whose subscription keys live
          // capacity), per the Phase B contract. Duration is the authoritative
          // LiveKit room lifetime carried in-band by room_finished
          // (event.createdAt − room.creationTime); classroom_lessons stores no
          // lesson timestamps. First-wins via already_completed.
          if (result.ok && !result.already_ended) {
            const elapsed = elapsedSecondsFromCreationTime(
              (event as any)?.room?.creationTime,
              typeof rawTs === 'number' && rawTs > 0 ? rawTs : Math.floor(Date.now() / 1000)
            );
            if (elapsed !== null) {
              const { ownerId } = await resolveLessonClassContext(lessonId);
              if (ownerId) {
                const accounting = await recordFreeUsage(
                  ownerId,
                  'class',
                  elapsed,
                  new Date(endedAtISO)
                );
                if (accounting.error) {
                  console.error('[LiveKitWebhook] Class free-tier accounting failed:', accounting.detail);
                }
              }
            }
          }
        }
      }
      // Unknown room name: acknowledge, do not act.
    }
  } catch (err) {
    // Never 5xx a verified webhook for application-level failures: LiveKit
    // would retry and the RPC is idempotent, so log and ack.
    console.error('[LiveKitWebhook] room_finished handling failed:', err);
  }

  return NextResponse.json({
    received: true,
    event: eventName,
    room: roomName,
    processed: result.ok,
    already_ended: result.already_ended,
    // Acknowledge success even when the RPC was a no-op replay.
    skip_retry: result.ok,
  });
}
