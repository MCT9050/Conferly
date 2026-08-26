import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { resolveClassroom, verifyClassroomAccess, isTeachingRole } from '@/lib/classroomAuth';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import CreateAssignmentForm from '@/components/class/CreateAssignmentForm';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
}

export default async function AssignmentsIndexPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const session = await getServerSession();
  if (!session?.userId) redirect(`/auth?redirect=/class/classrooms/${slug}/lessons/${lessonId}/assignments`);

  const classroom = await resolveClassroom(slug);
  if (!classroom) notFound();
  const access = await verifyClassroomAccess(session.userId, slug);
  if (!access.granted) redirect('/class/dashboard');
  const teachingRole = access.source === 'owner' ? 'owner' : access.accessRole;
  const canManage = isTeachingRole(teachingRole);

  const supabase = getSupabaseServerClient();
  const { data: lesson, error: lessonErr } = await supabase
    .from('classroom_lessons')
    .select('id, classroom_id, title, status, scheduled_at')
    .eq('id', lessonId)
    .eq('classroom_id', classroom.id)
    .maybeSingle();

  if (lessonErr) {
    return (
      <div className="container mx-auto px-4 py-8 text-amber-200">Unable to load lesson.</div>
    );
  }
  if (!lesson) notFound();

  const { data: assignments, error } = await supabase
    .from('classroom_assignments')
    .select('id, title, instructions, due_at, max_score, created_at')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  const canonicalSlug = classroom.slug;

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <Link href={`/class/classrooms/${canonicalSlug}/lessons`} className="text-sm text-slate-400 hover:text-white">
        ← Back to lessons
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-white">Assignments</h1>
        <p className="text-sm text-slate-400">
          {lesson.title} · {classroom.title}
        </p>
      </div>

      {canManage && <CreateAssignmentForm lessonId={lessonId} />}

      {error ? (
        <div role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200">
          Unable to load assignments.
        </div>
      ) : assignments && assignments.length > 0 ? (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Link
              key={a.id}
              href={`/class/classrooms/${canonicalSlug}/lessons/${lessonId}/assignments/${a.id}`}
              className="block rounded-xl border border-white/10 bg-slate-900/50 p-4 text-slate-200 hover:border-emerald-500/50"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-medium text-white">{a.title}</h2>
                  {a.instructions && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-400">{a.instructions}</p>
                  )}
                </div>
                <div className="text-xs text-slate-400 sm:text-right">
                  <div>Due: {formatDateTime(a.due_at)}</div>
                  <div>Max score: {a.max_score}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-400">
          {canManage
            ? 'No assignments yet. Use the form above to add the first one.'
            : 'No assignments have been posted for this lesson yet.'}
        </div>
      )}
    </div>
  );
}
