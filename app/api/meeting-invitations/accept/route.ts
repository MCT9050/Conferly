import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  hashInvitationToken,
  validateMeetingSlugInput,
  validateRawInvitationToken,
} from '@/lib/meetingInvitationToken';

type AcceptInvitationRequest = {
  room?: unknown;
  invite?: unknown;
};

type AcceptInvitationRow = {
  meeting_id: string;
  slug: string;
  database_role: 'attendee' | 'host' | 'presenter' | string;
};

type AcceptMeetingInvitationArgs = {
  p_meeting_slug: string;
  p_token_hash: string;
};

function mapDatabaseRole(databaseRole: string): 'owner' | 'presenter' | 'participant' {
  if (databaseRole === 'host') return 'owner';
  if (databaseRole === 'presenter') return 'presenter';
  return 'participant';
}

function mapInvitationError(error: unknown): { status: number; message: string } {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('invalid invitation')
  ) {
    return { status: 400, message: 'Invitation is invalid' };
  }

  return { status: 500, message: 'Unable to join right now' };
}

export async function POST(request: Request) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as AcceptInvitationRequest;

  let room: string;
  let rawToken: string;

  try {
    room = validateMeetingSlugInput(payload.room);
    rawToken = validateRawInvitationToken(payload.invite);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invitation is invalid' }, { status: 400 });
  }

  const tokenHash = hashInvitationToken(rawToken);
  const supabase = createSupabaseServerClient({ request });

  const rpcArgs = {
    p_meeting_slug: room,
    p_token_hash: tokenHash,
  } satisfies AcceptMeetingInvitationArgs;
  const { data, error } = await supabase.rpc('accept_meeting_invitation', rpcArgs);

  if (error) {
    const mapped = mapInvitationError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }

  const row = Array.isArray(data) ? (data[0] as AcceptInvitationRow | undefined) : undefined;
  if (!row?.meeting_id || !row.slug || !row.database_role) {
    return NextResponse.json({ ok: false, error: 'Unable to join right now' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    meetingId: row.meeting_id,
    room: row.slug,
    role: mapDatabaseRole(row.database_role),
  });
}