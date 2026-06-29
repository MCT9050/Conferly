import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: lessonId } = await params;
  const supabase = createSupabaseServerClient({ request });

  // Get lesson + classroom owner
  const { data: lesson, error: lessonErr } = await supabase
    .from('classroom_lessons')
    .select('id, classroom_id, status, classrooms!inner(owner_id)')
    .eq('id', lessonId)
    .single();

  if (lessonErr || !lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  // Verify instructor/TA
  const { data: enrollment } = await supabase
    .from('classroom_enrollments')
    .select('role')
    .eq('classroom_id', lesson.classroom_id)
    .eq('student_id', session.userId)
    .in('role', ['instructor', 'ta'])
    .single();

  const isOwner = (lesson.classrooms as any)?.owner_id === session.userId;
  if (!isOwner && !enrollment) {
    return NextResponse.json({ error: 'Only instructors can launch' }, { status: 403 });
  }

  const livekitRoomId = `class-${lesson.classroom_id}-${lessonId}`;

  const { error: updateErr } = await supabase
    .from('classroom_lessons')
    .update({ status: 'live', livekit_room_id: livekitRoomId })
    .eq('id', lessonId);

  if (updateErr) {
    return NextResponse.json({ error: 'Launch failed' }, { status: 500 });
  }

  return NextResponse.json({
    lessonId,
    livekitRoomId,
    joinUrl: `/class/classrooms/${lesson.classroom_id}/lessons/${lessonId}/live`,
  });
}