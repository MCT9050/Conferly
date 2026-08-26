import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createExplicitMeeting, normalizeMeetingSlug } from '@/lib/meetingPersistence';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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