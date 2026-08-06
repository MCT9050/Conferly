import ClassLiveSession from '@/components/class/ClassLiveSession';
import { getServerSession } from '@/lib/auth';
import { verifyClassLessonAccess } from '@/lib/accessControl';
import { notFound, redirect } from 'next/navigation';

export default async function ClassLivePage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const session = await getServerSession();
  if (!session) redirect('/auth');

  const access = await verifyClassLessonAccess(session.userId, slug, lessonId);
  if (!access.classroom || !access.lesson) notFound();
  if (!access.granted) redirect('/class/dashboard');
  if (access.lesson.status === 'cancelled' || access.lesson.status !== 'live') {
    redirect(`/class/classrooms/${access.classroom.slug}/lessons`);
  }

  return (
    <ClassLiveSession
      classroomId={access.classroom.id}
      lessonId={access.lesson.id}
      userId={session.userId}
      role={access.accessRole}
      userName={session.email}
    />
  );
}