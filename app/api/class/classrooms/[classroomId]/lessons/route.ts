import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
// P4-6: write path uses the established service-role client after explicit
// application-level authorization (mirrors enrollments/assignments routes).
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import { normaliseRequiredTitle } from '@/lib/classValidation';
import { verifyClassroomTeachingAccess } from '@/lib/classroomAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  const session = await getServerSession(request);
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { classroomId } = await params;
  const access = await verifyClassroomTeachingAccess(session.userId, classroomId);
  if (!access.classroom) return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  if (!access.granted) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const title = normaliseRequiredTitle(payload.title);
  if (!title.ok) return NextResponse.json({ error: title.error }, { status: 400 });

  let scheduledAt: string | null = null;
  if (typeof payload.scheduled_at === 'string' && payload.scheduled_at.trim()) {
    const parsed = new Date(payload.scheduled_at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Scheduled time is invalid' }, { status: 400 });
    }
    scheduledAt = parsed.toISOString();
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('classroom_lessons')
    .insert({ classroom_id: access.classroom.id, title: title.value, scheduled_at: scheduledAt, status: 'scheduled' })
    .select('id, classroom_id, title, status, scheduled_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Unable to create lesson' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}