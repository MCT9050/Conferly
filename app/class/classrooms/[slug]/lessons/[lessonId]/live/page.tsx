import ClassLiveSession from '@/components/class/ClassLiveSession';
import { getServerSession } from '@/lib/auth';
import { verifyAccess } from '@/lib/accessControl';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ClassLivePage({
  params,
}: {
  params: { slug: string; lessonId: string };
}) {
  const session = await getServerSession();
  if (!session) redirect('/auth');

  const access = await verifyAccess('class', session.userId, params.slug);
  if (!access.granted) redirect('/dashboard');

  const supabase = createSupabaseServerClient();
  const { data: lesson } = await supabase
    .from('classroom_lessons')
    .select('id, title, status, livekit_room_id')
    .eq('id', params.lessonId)
    .eq('classroom_id', access.roomId)
    .single();

  if (!lesson || lesson.status === 'cancelled') {
    redirect(`/class/classrooms/${params.slug}/lessons`);
  }

  return (
    <ClassLiveSession
      roomId={lesson.livekit_room_id || `${params.slug}-${params.lessonId}`}
      lessonId={params.lessonId}
      classroomId={access.roomId}
      userId={session.userId}
      role={access.role}
      userName={session.email}
    />
  );
}