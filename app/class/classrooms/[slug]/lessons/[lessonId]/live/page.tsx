import ClassLiveSession from '@/components/class/ClassLiveSession';
import { getServerSession } from '@/lib/auth';
import { verifyAccess } from '@/lib/accessControl';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ClassLivePage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const session = await getServerSession();
  if (!session) redirect('/auth');

  const access = await verifyAccess('class', session.userId, slug);
  if (!access.granted) redirect('/dashboard');

  const supabase = createSupabaseServerClient();
  const { data: lesson } = await supabase
    .from('classroom_lessons')
    .select('id, title, status, livekit_room_id')
    .eq('id', lessonId)
    .eq('classroom_id', access.roomId)
    .single();

  if (!lesson || lesson.status === 'cancelled') {
    redirect(`/class/classrooms/${slug}/lessons`);
  }

  return (
    <ClassLiveSession
      roomId={lesson.livekit_room_id || `${slug}-${lessonId}`}
      lessonId={lessonId}
      classroomId={access.roomId}
      userId={session.userId}
      role={access.role}
      userName={session.email}
    />
  );
}