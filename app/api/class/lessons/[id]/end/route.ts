import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import { verifyClassroomTeachingAccess } from '@/lib/classroomAuth';
import { isUuid } from '@/lib/classValidation';
import { getLiveRoomElapsedSeconds, recordFreeUsage } from '@/lib/freeTierAccounting';

type EndResult = {
  ok?: boolean;
  reason?: string;
  lesson_id?: string;
  status?: string;
  already_completed?: boolean;
};

/**
 * POST /api/class/lessons/[id]/end  (P4-2a)
 *
 * Teaching-role gated transition live -> completed. Authorization runs here
 * first (verifyClassroomTeachingAccess); the state transition itself is
 * delegated to the SECURITY DEFINER RPC end_class_lesson_atomic(), which locks
 * the lesson row and guards the UPDATE on status = 'live'. The LiveKit room
 * reconciliation path (P4-2b) reuses this same RPC as its single authority.
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
    return NextResponse.json({ error: 'Only instructors can end lessons' }, { status: 403 });
  }

  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('end_class_lesson_atomic', { p_lesson_id: lessonId });

  if (rpcErr) {
    return NextResponse.json({ error: 'End failed' }, { status: 500 });
  }

  const result = (rpcData as unknown) as EndResult | null;
  if (!result || result.ok === false) {
    const reason = result?.reason ?? 'unknown';
    const status =
      reason === 'cancelled' ? 400
      : reason === 'not_live' ? 409
      : reason === 'not_found' ? 404
      : 500;
    return NextResponse.json({ error: `End failed: ${reason}` }, { status });
  }

  // Phase C: free-tier accounting on the authoritative lesson termination.
  // Duration source: the LiveKit room lifetime (room.creationTime → now) —
  // classroom_lessons stores no start/end timestamps and no frontend clock is
  // trusted. If the room can no longer be resolved, accounting is skipped here
  // and the LiveKit room_finished webhook (which carries creationTime in-band)
  // remains the authority. First-wins via the RPC's already_completed flag —
  // webhook and host action share this RPC, so a lesson is never charged
  // twice. Paid owners are skipped inside the Phase B RPC.
  if (!result.already_completed) {
    const roomName =
      typeof lesson.livekit_room_id === 'string' && lesson.livekit_room_id.length > 0
        ? lesson.livekit_room_id
        : null;
    const elapsed = roomName ? await getLiveRoomElapsedSeconds(roomName) : null;
    if (elapsed !== null) {
      const ownerId =
        classroom && typeof classroom.owner_id === 'string' ? classroom.owner_id : null;
      if (ownerId) {
        const accounting = await recordFreeUsage(ownerId, 'class', elapsed, new Date());
        if (accounting.error) {
          console.error('[LessonEnd] free-tier accounting failed:', accounting.detail);
        }
      }
    }
  }

  return NextResponse.json({
    lessonId: result.lesson_id ?? lessonId,
    status: 'completed',
    alreadyCompleted: Boolean(result.already_completed),
  });
}
