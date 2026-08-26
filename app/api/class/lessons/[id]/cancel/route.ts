import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import { verifyClassroomTeachingAccess } from '@/lib/classroomAuth';
import { isUuid } from '@/lib/classValidation';

type CancelResult = {
  ok?: boolean;
  reason?: string;
  lesson_id?: string;
  status?: string;
  already_cancelled?: boolean;
};

/**
 * POST /api/class/lessons/[id]/cancel  (P4-2a)
 *
 * Teaching-role gated transition scheduled -> cancelled. Authorization runs
 * here first (verifyClassroomTeachingAccess); the state transition itself is
 * delegated to the SECURITY DEFINER RPC cancel_class_lesson_atomic(), which
 * locks the lesson row and guards the UPDATE on status = 'scheduled'.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: lessonId } = await params;
  if (!isUuid(lessonId)) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  // Authorize against the lesson's owning classroom before touching state.
  const supabase = getSupabaseServerClient();
  const { data: lesson, error: lessonErr } = await supabase
    .from('classroom_lessons')
    .select('id, classroom_id, status, classrooms!inner(id, slug, owner_id)')
    .eq('id', lessonId)
    .maybeSingle();

  if (lessonErr) {
    return NextResponse.json({ error: 'Unable to load lesson' }, { status: 500 });
  }
  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  const classroom = Array.isArray(lesson.classrooms) ? lesson.classrooms[0] : lesson.classrooms;
  const access = await verifyClassroomTeachingAccess(session.userId, lesson.classroom_id);
  if (!access.granted || !classroom || access.classroom?.id !== lesson.classroom_id) {
    return NextResponse.json({ error: 'Only instructors can cancel lessons' }, { status: 403 });
  }

  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('cancel_class_lesson_atomic', { p_lesson_id: lessonId });

  if (rpcErr) {
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 });
  }

  const result = (rpcData as unknown) as CancelResult | null;
  if (!result || result.ok === false) {
    const reason = result?.reason ?? 'unknown';
    const status =
      reason === 'live' ? 409
      : reason === 'not_scheduled' ? 409
      : reason === 'not_found' ? 404
      : 500;
    return NextResponse.json({ error: `Cancel failed: ${reason}` }, { status });
  }

  return NextResponse.json({
    lessonId: result.lesson_id ?? lessonId,
    status: 'cancelled',
    alreadyCancelled: Boolean(result.already_cancelled),
  });
}
