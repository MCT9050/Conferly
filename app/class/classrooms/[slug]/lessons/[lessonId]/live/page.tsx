import { ClassroomSession } from '@/components/class/ClassroomSession';
import EndLessonButton from '@/components/class/EndLessonButton';
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

  const authenticatedSession = session!;

  const access = await verifyClassLessonAccess(authenticatedSession.userId, slug, lessonId);
  if (!access.classroom || !access.lesson) notFound();
  if (!access.granted) redirect('/class/dashboard');

  const classroom = access.classroom!;
  const lesson = access.lesson!;

  if (lesson.status === 'cancelled' || lesson.status !== 'live') {
    redirect(`/class/classrooms/${classroom.slug}/lessons`);
  }

    // Derive the canonical classroom role from server-authoritative access.
  // Owner is NOT an enrollment role — it is derived from access.source.
  // At this point access.granted is true, so accessRole is never 'spectator'.
  const classroomRole = access.source === 'owner'
    ? 'owner'
    : (access.accessRole as 'instructor' | 'ta' | 'student' | 'auditor');
  // P4-2a: only teaching roles may end a live lesson.
  const canEndLesson = access.source === 'owner' || access.accessRole === 'instructor' || access.accessRole === 'ta';

  return (
    <div>
      {canEndLesson && (
        <div className="container mx-auto flex justify-end pt-4">
          <EndLessonButton
            lessonId={lesson.id}
            redirectTo={`/class/classrooms/${classroom.slug}/lessons`}
          />
        </div>
      )}
      <ClassroomSession
        classroomId={classroom.id}
        classroomTitle={classroom.title}
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        userId={authenticatedSession.userId}
        userName={authenticatedSession.email ?? `User-${authenticatedSession.userId.slice(0, 4)}`}
        userRole={classroomRole}
      />
    </div>
  );
}

