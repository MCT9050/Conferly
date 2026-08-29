import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import { verifyClassroomTeachingAccess } from '@/lib/classroomAuth';
import { isUuid } from '@/lib/classValidation';
import { getFreeTierStatus } from '@/lib/freeTier';
import { freeTierStartDecision } from '@/lib/freeTierAccounting';

type LaunchResult = {
  ok?: boolean;
  reason?: string;
  lesson_id?: string;
  livekit_room_id?: string | null;
  status?: string;
  already_live?: boolean;
};

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

  // First, look up the lesson + classroom to authorize the call.
  const supabase = getSupabaseServerClient();
  const { data: lesson, error: lessonErr } = await supabase
    .from('classroom_lessons')
    .select('id, classroom_id, status, livekit_room_id, classrooms!inner(id, slug, owner_id)')
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
    return NextResponse.json({ error: 'Only instructors can launch' }, { status: 403 });
  }

  // Phase C: free-tier access gate for Class. The classroom OWNER is the
  // charged party per the Phase B contract (the same party whose subscription
  // keys live capacity), so the gate runs when the owner launches their own
  // lesson — the dominant flow. Existing authorization above remains
  // authoritative; this only distinguishes paid / free available / free
  // exhausted / registration required. Non-owner teaching roles keep the
  // existing path; the Phase B consume RPC independently refuses to charge an
  // exhausted or paid owner at accounting time.
  if (classroom.owner_id === session.userId) {
    const classFreeStatus = await getFreeTierStatus('class');
    const decision = freeTierStartDecision(classFreeStatus);
    if (!decision.allow) {
      return NextResponse.json(
        { error: decision.message, code: decision.code },
        { status: decision.httpStatus }
      );
    }
  }

  // Atomic state-guarded launch via SECURITY DEFINER RPC. The RPC performs
  // SELECT ... FOR UPDATE on the lesson row and uses WHERE status =
  // 'scheduled' on the UPDATE so two concurrent launchers cannot both flip
  // the lesson to 'live'. Returns { ok, lesson_id, livekit_room_id, status,
  // already_live } or { ok: false, reason }.
  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('launch_class_lesson_atomic', { p_lesson_id: lessonId });

  if (rpcErr) {
    return NextResponse.json({ error: 'Launch failed' }, { status: 500 });
  }

  const result = (rpcData as unknown) as LaunchResult | null;
  if (!result || result.ok === false) {
    const reason = result?.reason ?? 'unknown';
    const status =
      reason === 'cancelled' ? 400
      : reason === 'not_scheduled' ? 409
      : reason === 'not_found' ? 404
      : 500;
    return NextResponse.json({ error: `Launch failed: ${reason}` }, { status });
  }

  return NextResponse.json({
    lessonId: result.lesson_id ?? lessonId,
    joinUrl: `/class/classrooms/${classroom.slug}/lessons/${lessonId}/live`,
    alreadyLive: Boolean(result.already_live),
  });
}
