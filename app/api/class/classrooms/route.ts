import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
// P4-6: writes use the established service-role client after explicit
// application-level authorization; the read path keeps its original
// user-JWT SSR client so list semantics are byte-for-byte unchanged.
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import {
  createClassroomSlug,
  normaliseDescription,
  normaliseEnrollmentType,
  normalisePriceCents,
  normaliseRequiredTitle,
  normaliseSubject,
} from '@/lib/classValidation';

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const title = normaliseRequiredTitle(payload.title);
  if (!title.ok) return NextResponse.json({ error: title.error }, { status: 400 });
  const description = normaliseDescription(payload.description);
  if (!description.ok) return NextResponse.json({ error: description.error }, { status: 400 });
  const subject = normaliseSubject(payload.subject);
  if (!subject.ok) return NextResponse.json({ error: subject.error }, { status: 400 });
  const enrollmentType = normaliseEnrollmentType(payload.enrollment_type);
  if (!enrollmentType.ok) return NextResponse.json({ error: enrollmentType.error }, { status: 400 });
  const priceCents = normalisePriceCents(payload.price_cents);
  if (!priceCents.ok) return NextResponse.json({ error: priceCents.error }, { status: 400 });

  const supabase = getSupabaseServerClient();

  let data: { id: string; slug: string; title: string } | null = null;
  let unresolvedCollision = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug = createClassroomSlug(
      title.value,
      attempt === 0 ? undefined : Math.random().toString(36).slice(2, 7)
    );
    const { data: inserted, error } = await supabase
      .from('classrooms')
      .insert({
        owner_id: session.userId,
        title: title.value,
        description: description.value,
        subject: subject.value,
        enrollment_type: enrollmentType.value,
        price_cents: priceCents.value,
        status: 'draft',
        slug,
      })
      .select('id, slug, title')
      .single();

    if (!error && inserted) {
      data = inserted;
      break;
    }
    if (error?.code === '23505') {
      unresolvedCollision = true;
      continue;
    }
    return NextResponse.json({ error: 'Unable to create classroom' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: unresolvedCollision ? 'Unable to create a unique classroom slug' : 'Unable to create classroom' },
      { status: unresolvedCollision ? 409 : 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServerClient({ request });
  const { data, error } = await supabase
    .from('classrooms')
    .select('*, classroom_enrollments(role, enrollment_status)')
    .or(`owner_id.eq.${session.userId},classroom_enrollments.student_id.eq.${session.userId}`);

  if (error) {
    return NextResponse.json({ error: 'Unable to load classrooms' }, { status: 500 });
  }

  return NextResponse.json(data);
}