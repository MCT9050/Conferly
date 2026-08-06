import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth';
import { isTeachingRole, resolveClassroom, verifyClassroomAccess } from '@/lib/classroomAuth';

function formatDate(value: string | null): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'No date' : parsed.toLocaleDateString();
}

export default async function StudentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getServerSession();
  if (!session?.userId) redirect('/auth?product=class');
  const classroom = await resolveClassroom(slug);
  if (!classroom) notFound();
  const access = await verifyClassroomAccess(session.userId, slug);
  const role = access.source === 'owner' ? 'owner' : access.accessRole;
  if (!access.granted || !isTeachingRole(role)) redirect(`/class/classrooms/${classroom.slug}`);

  const supabase = createSupabaseServerClient();
  const { data: enrollments, error } = await supabase
    .from('classroom_enrollments')
    .select('id, student_id, role, enrollment_status, progress_percent, enrolled_at')
    .eq('classroom_id', classroom.id)
    .order('enrolled_at', { ascending: false });

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <Link href={`/class/classrooms/${classroom.slug}`} className="text-sm text-slate-400 hover:text-white">← Back to classroom</Link>
      <h1 className="text-3xl font-bold text-white">Roster for {classroom.title}</h1>
      <p className="text-sm text-slate-400">Only safe enrollment identifiers are shown in Phase 1.</p>
      {error ? <div role="alert" className="text-amber-200">Unable to load roster.</div> : enrollments && enrollments.length > 0 ? (
        <div className="space-y-2">{enrollments.map((e) => <div key={e.id} className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-slate-200"><div className="font-medium">Person {e.student_id.slice(0, 8)}…</div><div className="text-sm text-slate-400">{e.role} · {e.enrollment_status} · {e.progress_percent ?? 0}% · {formatDate(e.enrolled_at)}</div></div>)}</div>
      ) : <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-400">No enrollments yet.</div>}
    </div>
  );
}