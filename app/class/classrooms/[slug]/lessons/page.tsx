import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth';
import { resolveClassroom, verifyClassroomAccess, isTeachingRole } from '@/lib/classroomAuth';
import CreateLessonForm from '@/components/class/CreateLessonForm';
import LaunchLessonButton from '@/components/class/LaunchLessonButton';
import CancelLessonButton from '@/components/class/CancelLessonButton';
import EndLessonButton from '@/components/class/EndLessonButton';


function formatScheduledAt(value: string | null): string {
  if (!value) return 'No scheduled time';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'No scheduled time' : parsed.toLocaleString();
}

export default async function LessonsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getServerSession();
  if (!session?.userId) redirect('/auth?product=class');

  const classroom = await resolveClassroom(slug);
  if (!classroom) notFound();
  const access = await verifyClassroomAccess(session.userId, slug);
  if (!access.granted) redirect('/class/dashboard');
  const teachingRole = access.source === 'owner' ? 'owner' : access.accessRole;
  const canManage = isTeachingRole(teachingRole);
  const canonicalSlug = classroom.slug;

  const supabase = createSupabaseServerClient();
  const { data: lessons, error } = await supabase
    .from('classroom_lessons')
    .select('id, title, status, scheduled_at, livekit_room_id, order_index')
    .eq('classroom_id', classroom.id)
    .order('scheduled_at', { ascending: true, nullsFirst: false });

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <Link href={`/class/classrooms/${canonicalSlug}`} className="text-sm text-slate-400 hover:text-white">← Back to classroom</Link>
      <div>
        <h1 className="text-3xl font-bold text-white">Lessons for {classroom.title}</h1>
        <p className="text-sm text-slate-400">{classroom.subject ?? 'Classroom lessons'}</p>
      </div>
      {canManage && <CreateLessonForm classroomId={classroom.id} />}
      {error ? (
        <div role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200">Unable to load lessons.</div>
      ) : lessons && lessons.length > 0 ? (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-medium text-white">{lesson.title}</h2>
                <p className="text-sm text-slate-400">{formatScheduledAt(lesson.scheduled_at)} · {lesson.status}</p>
              </div>
                            <div className="flex flex-wrap gap-2">
                {lesson.status === 'live' && (
                  <>
                    <Link className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white" href={`/class/classrooms/${canonicalSlug}/lessons/${lesson.id}/live`}>Join Live</Link>
                    {canManage && <EndLessonButton lessonId={lesson.id} />}
                  </>
                )}
                {canManage && lesson.status === 'scheduled' && <LaunchLessonButton lessonId={lesson.id} />}
                {canManage && lesson.status === 'scheduled' && <CancelLessonButton lessonId={lesson.id} />}

                <Link
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-100 hover:bg-white/5"
                  href={`/class/classrooms/${canonicalSlug}/lessons/${lesson.id}/assignments`}
                >
                  Assignments
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-400">
          No lessons yet.{canManage ? ' Create Lesson to begin.' : ''}
        </div>
      )}
    </div>
  );
}