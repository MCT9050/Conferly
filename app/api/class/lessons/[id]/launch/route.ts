import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { verifyClassroomTeachingAccess } from '@/lib/classroomAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: lessonId } = await params;
  const supabase = createSupabaseServerClient({ request });

  const { data: lesson, error: lessonErr } = await supabase
    .from('classroom_lessons')
    .select('id, classroom_id, status, livekit_room_id, classrooms!inner(id, slug, owner_id)')
    .eq('id', lessonId)
    .single();

  if (lessonErr || !lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  if (lesson.status === 'cancelled') {
    return NextResponse.json({ error: 'Cancelled lessons cannot be launched' }, { status: 400 });
  }

  const classroom = Array.isArray(lesson.classrooms) ? lesson.classrooms[0] : lesson.classrooms;
  const access = await verifyClassroomTeachingAccess(session.userId, lesson.classroom_id);
  if (!access.granted || !classroom || access.classroom?.id !== lesson.classroom_id) {
    return NextResponse.json({ error: 'Only instructors can launch' }, { status: 403 });
  }

  const livekitRoomId = lesson.livekit_room_id || `class-${lesson.classroom_id}-${lessonId}`;

  const { error: updateErr } = await supabase
    .from('classroom_lessons')
    .update({ status: 'live', livekit_room_id: livekitRoomId })
    .eq('id', lessonId);

  if (updateErr) {
    return NextResponse.json({ error: 'Launch failed' }, { status: 500 });
  }

  return NextResponse.json({
    lessonId,
    joinUrl: `/class/classrooms/${classroom.slug}/lessons/${lessonId}/live`,
  });
}