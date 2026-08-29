import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createExplicitMeeting, normalizeMeetingSlug } from '@/lib/meetingPersistence';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getFreeTierStatus } from '@/lib/freeTier';
import { freeTierStartDecision } from '@/lib/freeTierAccounting';

type CreateMeetingRequest = {
  slug?: unknown;
};

export async function POST(request: Request) {
  const session = await getServerSession(request);

  if (!session?.userId) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  // Phase C: free-tier access gate for Meet. Authentication above remains the
  // anonymous boundary (registration required); this gate distinguishes paid /
  // free available / free exhausted using the database-computed status. The
  // per-meeting authorization itself is unchanged and stays authoritative at
  // join time (verifyRoomAccess / verifyAccess).
  const meetFreeStatus = await getFreeTierStatus('meet');
  const meetDecision = freeTierStartDecision(meetFreeStatus);
  if (!meetDecision.allow) {
    return NextResponse.json(
      {
        ok: false,
        error: meetDecision.message,
        code: meetDecision.code,
      },
      { status: meetDecision.httpStatus },
    );
  }

  let requestedSlug: string | null = null;

  try {
    const payload = (await request.json().catch(() => ({}))) as CreateMeetingRequest;
    if (typeof payload.slug === 'string' && payload.slug.trim()) {
      // normalizeMeetingSlug throws if the slug does not match the
      // 6-64 lowercase letter/number/hyphen pattern; the catch below maps
      // that to a 400 with a specific message.
      try {
        requestedSlug = normalizeMeetingSlug(payload.slug);
      } catch (slugErr) {
        return NextResponse.json(
          {
            ok: false,
            error:
              slugErr instanceof Error
                ? slugErr.message
                : 'Invalid meeting slug',
          },
          { status: 400 },
        );
      }
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid meeting slug' },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient({ request });
  const result = await createExplicitMeeting(supabase, session.userId, requestedSlug);

  if (result.ok) {
    return NextResponse.json({ ok: true, meeting: { id: result.id, slug: result.slug } });
  }

  if (result.status === 409) {
    return NextResponse.json(
      { ok: false, error: 'Meeting slug is already in use' },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { ok: false, error: 'Unable to create meeting' },
    { status: 500 },
  );
}