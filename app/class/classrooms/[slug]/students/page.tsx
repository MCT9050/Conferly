import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getServerSession } from '@/lib/auth';
import { isTeachingRole, resolveClassroom, verifyClassroomAccess } from '@/lib/classroomAuth';
import { countClassroomRoles, resolveClassEntitlement } from '@/lib/classEntitlements';
import EnrollStudentForm from '@/components/class/EnrollStudentForm';
import RosterActions from '@/components/class/RosterActions';

function formatDate(value: string | null): string {
  if (!value) return 'No date';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'No date' : parsed.toLocaleDateString();
}

function formatRoleLabel(role: string): string {
  switch (role) {
    case 'instructor': return 'Instructor';
    case 'ta': return 'Teaching assistant';
    case 'student': return 'Student';
    case 'auditor': return 'Auditor';
    default: return role;
  }
}

type ProfileInfo = { display_name: string; full_name: string | null; email: string | null };

function memberLabel(profile: ProfileInfo | undefined, studentId: string): string {
  const name = profile?.full_name?.trim() || profile?.display_name?.trim();
  if (name) return profile?.email ? `${name} (${profile.email})` : name;
  return `Member ${studentId.slice(0, 8)}…`;
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

  // Teacher-facing display names for the roster (service-role read; the
  // user-scoped client above stays for RLS-protected enrollment rows).
  const adminSupabase = getSupabaseServerClient();
  const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id))];
  const { data: profiles } = studentIds.length
    ? await adminSupabase
        .from('profiles')
        .select('id, display_name, full_name, email')
        .in('id', studentIds)
    : { data: [] as Array<{ id: string; display_name: string; full_name: string | null; email: string | null }> | null };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Display-only capacity summary. Authoritative enforcement remains at join
  // time via enforce_classroom_capacity_atomic.
  const entitlement = await resolveClassEntitlement(classroom.owner_id);
  const counts = await countClassroomRoles(classroom.id, classroom.owner_id);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <Link href={`/class/classrooms/${classroom.slug}`} className="text-sm text-slate-400 hover:text-white">← Back to classroom</Link>
      <div>
        <h1 className="text-3xl font-bold text-white">Roster for {classroom.title}</h1>
        <p className="text-sm text-slate-400">Enroll students and manage classroom membership.</p>
      </div>

      <EnrollStudentForm classroomId={classroom.id} />

      <div className="text-sm text-slate-400">
        {entitlement && counts
          ? `${counts.studentCount} of ${entitlement.studentLimit} student seats used · ${counts.teacherCount} of ${entitlement.teacherLimit} teacher seats (${entitlement.plan})`
          : 'Capacity summary unavailable (no active Class subscription on this classroom).'}
      </div>

      {error ? (
        <div role="alert" className="text-amber-200">Unable to load roster.</div>
      ) : enrollments && enrollments.length > 0 ? (
        <div className="space-y-2">
          {enrollments.map((e) => (
            <div key={e.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-4 text-slate-200 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">{memberLabel(profileById.get(e.student_id), e.student_id)}</div>
                <div className="text-sm text-slate-400">
                  {formatRoleLabel(e.role)} · {e.enrollment_status} · {e.progress_percent ?? 0}% · {formatDate(e.enrolled_at)}
                </div>
              </div>
              <RosterActions
                classroomId={classroom.id}
                studentId={e.student_id}
                studentLabel={memberLabel(profileById.get(e.student_id), e.student_id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-400">
          No enrollments yet. Use the form above to add the first student.
        </div>
      )}

    </div>
  );
}
