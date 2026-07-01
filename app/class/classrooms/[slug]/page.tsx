import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ClassroomDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // Fetch classroom by slug or ID
  const { data: classroom, error } = await supabase
    .from('classrooms')
    .select('id, owner_id, slug, title, description, subject, status, enrollment_type, settings')
    .or(`slug.eq.${slug},id.eq.${slug}`)
    .single();

  if (error || !classroom) {
    notFound();
  }

  // Fetch lessons for this classroom
  const { data: lessons } = await supabase
    .from('classroom_lessons')
    .select('id, title, status, scheduled_at, livekit_room_id, order_index')
    .eq('classroom_id', classroom.id)
    .order('order_index', { ascending: true });

  // Fetch enrollments (student roster)
  const { data: enrollments } = await supabase
    .from('classroom_enrollments')
    .select('id, student_id, role, enrollment_status, enrolled_at')
    .eq('classroom_id', classroom.id);

  const isOwner = classroom.owner_id === user.id;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link href="/class/dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
          ← Back to Classrooms
        </Link>
        <h1 className="text-3xl font-bold">{classroom.title}</h1>
        {classroom.description && (
          <p className="text-muted-foreground mt-2">{classroom.description}</p>
        )}
        <div className="flex items-center gap-4 mt-4 text-sm">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            {classroom.status}
          </span>
          {classroom.subject && <span className="text-muted-foreground">{classroom.subject}</span>}
          <span className="text-muted-foreground">
            {enrollments?.length || 0} student(s)
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      {isOwner && (
        <div className="mb-8 flex gap-3">
          <Link
            href={`/class/classrooms/${slug}/lessons`}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 transition-colors"
          >
            Manage Lessons
          </Link>
          <Link
            href={`/class/classrooms/${slug}/students`}
            className="rounded-lg border border-emerald-200 px-4 py-2 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950"
          >
            View Roster
          </Link>
        </div>
      )}

      {/* Lessons List */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Lessons</h2>
        {lessons && lessons.length > 0 ? (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <h3 className="font-medium">{lesson.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      lesson.status === 'live' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                      lesson.status === 'scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {lesson.status}
                    </span>
                    {lesson.scheduled_at && (
                      <span>{new Date(lesson.scheduled_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                {lesson.status === 'live' && (
                  <Link
                    href={`/class/classrooms/${slug}/lessons/${lesson.id}/live`}
                    className="rounded-lg bg-red-600 px-4 py-2 text-white text-sm hover:bg-red-700 transition-colors"
                  >
                    Join Live
                  </Link>
                )}
                {isOwner && lesson.status === 'scheduled' && (
                  <form action={`/api/class/lessons/${lesson.id}/launch`} method="POST">
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm hover:bg-emerald-700 transition-colors"
                    >
                      Launch Lesson
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground mb-4">No lessons yet</p>
            {isOwner && (
              <Link
                href={`/class/classrooms/${slug}/lessons`}
                className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 transition-colors"
              >
                Create First Lesson
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Student Roster Preview */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Students</h2>
        {enrollments && enrollments.length > 0 ? (
          <div className="space-y-2">
            {enrollments.map((enrollment) => (
              <div key={enrollment.id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">Student {enrollment.student_id.substring(0, 8)}...</span>
                <span className="text-sm text-muted-foreground">{enrollment.role}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No students enrolled yet</p>
        )}
      </div>
    </div>
  );
}
