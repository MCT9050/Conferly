import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  generateRawInvitationToken,
  hashInvitationToken,
  isSha256Hex,
} from '@/lib/meetingInvitationToken';

type CreateInvitationRequest = {
  role?: unknown;
  expiresAt?: unknown;
  maxUses?: unknown;
};

type RouteCtx = {
  params: Promise<{ meetingId: string }>;
};

type MeetingInvitationInsert = {
  meeting_id: string;
  token_hash: string;
  role: 'attendee' | 'presenter';
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeMeetingId(value: string): string | null {
  const normalized = value.trim();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeRole(value: unknown): 'attendee' | 'presenter' | null {
  if (value === undefined) return 'attendee';
  return value === 'attendee' || value === 'presenter' ? value : null;
}

function normalizeExpiresAt(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 64) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) return undefined;
  return parsed.toISOString();
}

function normalizeMaxUses(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10000) return undefined;
  return value;
}

export async function POST(request: Request, { params }: RouteCtx) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  const { meetingId: meetingIdParam } = await params;
  const meetingId = normalizeMeetingId(meetingIdParam);
  if (!meetingId) {
    return NextResponse.json({ ok: false, error: 'Meeting not found' }, { status: 404 });
  }

  const payload = (await request.json().catch(() => ({}))) as CreateInvitationRequest;
  const role = normalizeRole(payload.role);
  const expiresAt = normalizeExpiresAt(payload.expiresAt);
  const maxUses = normalizeMaxUses(payload.maxUses);

  if (!role || expiresAt === undefined || maxUses === undefined) {
    return NextResponse.json({ ok: false, error: 'Invalid invitation request' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient({ request });

  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('id, slug, owner')
    .eq('id', meetingId)
    .maybeSingle();

  if (meetingError) {
    return NextResponse.json({ ok: false, error: 'Unable to create invitation' }, { status: 500 });
  }

  if (!meeting) {
    return NextResponse.json({ ok: false, error: 'Meeting not found' }, { status: 404 });
  }

  if (meeting.owner !== session.userId) {
    return NextResponse.json({ ok: false, error: 'You do not have access' }, { status: 403 });
  }

  const rawToken = generateRawInvitationToken();
  const tokenHash = hashInvitationToken(rawToken);

  if (!isSha256Hex(tokenHash)) {
    return NextResponse.json({ ok: false, error: 'Unable to create invitation' }, { status: 500 });
  }

  const { data: invitation, error: insertError } = await supabase
    .from('meeting_invitations')
    .insert({
      meeting_id: meeting.id,
      token_hash: tokenHash,
      role,
      created_by: session.userId,
      expires_at: expiresAt,
      max_uses: maxUses,
    } satisfies MeetingInvitationInsert)
    .select('id, meeting_id, expires_at, max_uses')
    .single();

  if (insertError || !invitation) {
    return NextResponse.json({ ok: false, error: 'Unable to create invitation' }, { status: 500 });
  }

  const url = `/lobby?room=${encodeURIComponent(meeting.slug)}&intent=join&invite=${encodeURIComponent(rawToken)}`;

  return NextResponse.json({
    ok: true,
    invitationId: invitation.id,
    meetingId: invitation.meeting_id,
    room: meeting.slug,
    invite: rawToken,
    url,
    expiresAt: invitation.expires_at,
    maxUses: invitation.max_uses,
  });
}