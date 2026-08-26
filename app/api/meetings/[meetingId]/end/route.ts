import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { verifyAccess } from '@/lib/accessControl';
import { completeMeeting } from '@/lib/meetingLifecycle';

/**
 * POST /api/meetings/[meetingId]/end  (P4-2b host end-action fallback)
 *
 * Host-side termination path that shares the single authoritative persistence
 * helper (complete_meeting_atomic via completeMeeting()) with the LiveKit
 * webhook receiver, so webhook and host action can never diverge.
 *
 * Authorization: caller must be the meeting OWNER (verifyAccess source ===
 * 'owner'). Presenters/participants cannot end the host's meeting.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { meetingId } = await params;
  if (!meetingId) {
    return NextResponse.json({ error: 'Meeting id is required' }, { status: 400 });
  }

  const access = await verifyAccess('meet', session.userId, meetingId);
  if (!access.granted || access.source !== 'owner') {
    return NextResponse.json({ error: 'Only the meeting owner can end this meeting' }, { status: 403 });
  }

  // p_ended_at = authoritative server time for the host-initiated end.
  const endedAtISO = new Date().toISOString();
  const result = await completeMeeting(meetingId, endedAtISO);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? 'Unable to end meeting' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    meetingId: result.meeting_id ?? meetingId,
    ended_at: result.ended_at,
    duration_seconds: result.duration_seconds,
    already_ended: result.already_ended ?? false,
  });
}
