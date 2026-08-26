import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import { verifyClassroomTeachingAccess } from '@/lib/classroomAuth';
import { enforceClassCapacityAtomic } from '@/lib/classEntitlements';
import { isUuid } from '@/lib/classValidation';

const ALLOWED_ROLES = new Set(['instructor', 'ta', 'student', 'auditor']);

const ENROLLMENT_COLUMNS = 'id, classroom_id, student_id, role, enrollment_status, enrolled_at';

/** UX-only capacity payload attached to successful enrollment responses. */
type CapacityFeedback = {
  capacity?: {
    student_count: number;
    student_limit: number;
    teacher_count: number;
    teacher_limit: number;
    plan: string;
  };
  capacity_warning?: string;
};

/**
 * Enrollment-time capacity feedback.
 *
 * UX only — the authoritative capacity enforcement remains at join time
 * (lk-token → enforce_classroom_capacity_atomic). This runs the SAME database
 * RPC after the enrollment row exists, so the counts mirror exactly what a
 * live-join attempt would evaluate. A rejection here is surfaced to the
 * teacher as a warning on the response; it never rolls the enrollment back.
 */
async function capacityFeedback(
  classroomId: string,
  ownerId: string,
  role: 'instructor' | 'ta' | 'student' | 'auditor'
): Promise<CapacityFeedback> {
  const verdict = await enforceClassCapacityAtomic(classroomId, ownerId, role);
  if (!verdict.allowed) {
    return {
      capacity_warning: `${verdict.reason ?? 'Class capacity limit reached.'} Live-session joins for this member may be blocked.`,
    };
  }
  if (verdict.capacity && verdict.counts) {
    return {
      capacity: {
        student_count: verdict.counts.studentCount,
        student_limit: verdict.capacity.studentLimit,
        teacher_count: verdict.counts.teacherCount,
        teacher_limit: verdict.capacity.teacherLimit,
        plan: verdict.capacity.plan,
      },
    };
  }
  return {};
}

/**
 * GET /api/class/classrooms/[classroomId]/enrollments?q=<email|name|uuid>
 *
 * Lightweight student lookup for the enrollment form. Authorization mirrors
 * POST/DELETE exactly: caller must be a teaching role for the classroom.
 * Matches profiles by exact id (when q is a uuid) or case-insensitive
 * substring on email / full_name / display_name. Results are annotated with
 * `enrolled` so the UI can mark students already on the roster.
 *
 * Responses:
 *   200 { results: [{ id, email, display_name, full_name, enrolled }] }
 *   400 invalid input
 *   401 unauthenticated
 *   403 not a teaching role
 *   404 classroom not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { classroomId } = await params;
  if (!isUuid(classroomId)) {
    return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 });
  }

  const access = await verifyClassroomTeachingAccess(session.userId, classroomId);
  if (!access.classroom) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  }
  if (!access.granted) {
    return NextResponse.json(
      { error: 'Only the classroom owner or a teaching role can look up students' },
      { status: 403 }
    );
  }

  const rawQuery = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (rawQuery.length < 2) {
    return NextResponse.json({ results: [] });
  }
  // Keep the pattern safe for the PostgREST .or() parser (commas and parens
  // are delimiters there); cap length to keep the query cheap.
  const sanitized = rawQuery.slice(0, 80).replace(/[,()]/g, '');

  const supabase = getSupabaseServerClient();

  let profiles:
    | Array<{ id: string; email: string | null; display_name: string; full_name: string | null }>
    | null
    | undefined;
  let error: unknown;

  if (isUuid(sanitized)) {
    // Exact-id paste: resolve directly.
    const result = await supabase
      .from('profiles')
      .select('id, email, display_name, full_name')
      .eq('id', sanitized)
      .limit(1);
    profiles = result.data;
    error = result.error;
  } else {
    const pattern = `%${sanitized}%`;
    const result = await supabase
      .from('profiles')
      .select('id, email, display_name, full_name')
      .or(
        `email.ilike.${pattern},full_name.ilike.${pattern},display_name.ilike.${pattern}`
      )
      .limit(8);
    profiles = result.data;
    error = result.error;
  }

  if (error) {
    return NextResponse.json({ error: 'Unable to search students' }, { status: 500 });
  }

  const { data: roster } = await supabase
    .from('classroom_enrollments')
    .select('student_id')
    .eq('classroom_id', access.classroom.id);
  const enrolledIds = new Set((roster ?? []).map((row) => row.student_id));

  return NextResponse.json({
    results: (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      display_name: p.display_name,
      full_name: p.full_name,
      enrolled: enrolledIds.has(p.id),
    })),
  });
}

/**
 * POST /api/class/classrooms/[classroomId]/enrollments
 *
 * Enroll a student (or additional teaching role) into a classroom.
 *
 * Authorization: caller must be a teaching role for the classroom — the owner,
 * or a verified instructor/ta in classroom_enrollments.
 *
 * Body: { student_id: uuid, role?: 'instructor'|'ta'|'student'|'auditor' }
 *
 * Responses:
 *   201 { enrollment: { id, classroom_id, student_id, role, enrollment_status }, capacity?, capacity_warning? }
 *   200 { enrollment: <existing>, already_enrolled: true, capacity?, capacity_warning? }   (idempotent)
 *   400 invalid input
 *   401 unauthenticated
 *   403 caller is not a teaching role
 *   404 classroom not found
 *   500 unexpected error
 *
 * `capacity` / `capacity_warning` are enrollment-time UX feedback only; the
 * authoritative capacity enforcement stays at live-join time.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { classroomId } = await params;
  if (!isUuid(classroomId)) {
    return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 });
  }

  const access = await verifyClassroomTeachingAccess(session.userId, classroomId);
  if (!access.classroom) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  }
  if (!access.granted) {
    return NextResponse.json(
      { error: 'Only the classroom owner or a teaching role can enroll students' },
      { status: 403 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const studentId = typeof payload.student_id === 'string' ? payload.student_id.trim() : '';
  if (!isUuid(studentId)) {
    return NextResponse.json({ error: 'student_id must be a valid uuid' }, { status: 400 });
  }
  if (studentId === session.userId) {
    // Owner is the first teacher; re-enrolling the owner is a no-op.
    return NextResponse.json(
      { error: 'The classroom owner cannot be enrolled as a student' },
      { status: 400 }
    );
  }

  const role = typeof payload.role === 'string' ? payload.role.trim() : 'student';
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json(
      { error: 'role must be one of instructor, ta, student, auditor' },
      { status: 400 }
    );
  }

  // P4-5: teaching authority is granted only by the classroom owner.
  // Delegated instructors/TAs retain full management of student seats.
  if ((role === 'instructor' || role === 'ta') && access.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the classroom owner can grant teaching roles' },
      { status: 403 }
    );
  }

  const supabase = getSupabaseServerClient();

  // Verify the student actually exists in auth.users before attempting an
  // insert; the FK is ON DELETE CASCADE so a missing student would silently
  // error.
  const { data: student, error: studentErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', studentId)
    .maybeSingle();


  if (studentErr) {
    return NextResponse.json({ error: 'Unable to verify student' }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // Idempotent upsert via UNIQUE(classroom_id, student_id). The DB will
  // surface a 23505 if a concurrent insert wins the race; we treat that as
  // a successful (already_enrolled) result.
  const { data, error } = await supabase
    .from('classroom_enrollments')
    .upsert(
      {
        classroom_id: access.classroom.id,
        student_id: studentId,
        role,
        enrollment_status: 'active',
      },
      { onConflict: 'classroom_id,student_id', ignoreDuplicates: true }
    )
    .select(ENROLLMENT_COLUMNS)
    .maybeSingle();

  if (error) {
    // 23505 = unique_violation from a non-upsert path; treat as conflict.
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('classroom_enrollments')
        .select(ENROLLMENT_COLUMNS)
        .eq('classroom_id', access.classroom.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          {
            enrollment: existing,
            already_enrolled: true,
            ...(await capacityFeedback(access.classroom.id, access.classroom.owner_id, role as 'instructor' | 'ta' | 'student' | 'auditor')),
          },
          { status: 200 }
        );
      }
    }
    return NextResponse.json({ error: 'Unable to enroll student' }, { status: 500 });
  }

  if (!data) {
    // Upsert with ignoreDuplicates and zero rows affected means the row
    // already existed. Re-read it.
    const { data: existing } = await supabase
      .from('classroom_enrollments')
      .select(ENROLLMENT_COLUMNS)
      .eq('classroom_id', access.classroom.id)
      .eq('student_id', studentId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        {
          enrollment: existing,
          already_enrolled: true,
          ...(await capacityFeedback(access.classroom.id, access.classroom.owner_id, role as 'instructor' | 'ta' | 'student' | 'auditor')),
        },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: 'Unable to enroll student' }, { status: 500 });
  }

  return NextResponse.json(
    {
      enrollment: data,
      ...(await capacityFeedback(access.classroom.id, access.classroom.owner_id, role as 'instructor' | 'ta' | 'student' | 'auditor')),
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/class/classrooms/[classroomId]/enrollments
 *
 * Remove a student from a classroom. Caller must be a teaching role.
 * Idempotent: removing a non-existent enrollment returns 204.
 *
 * Body: { student_id: uuid }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { classroomId } = await params;
  if (!isUuid(classroomId)) {
    return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 });
  }

  const access = await verifyClassroomTeachingAccess(session.userId, classroomId);
  if (!access.classroom) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  }
  if (!access.granted) {
    return NextResponse.json(
      { error: 'Only the classroom owner or a teaching role can remove students' },
      { status: 403 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const studentId = typeof payload.student_id === 'string' ? payload.student_id.trim() : '';
  if (!isUuid(studentId)) {
    return NextResponse.json({ error: 'student_id must be a valid uuid' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  // P4-5: removing a teaching seat (instructor/ta) requires the owner.
  // A missing row falls through to the idempotent 204 delete below.
  const { data: targetEnrollment } = await supabase
    .from('classroom_enrollments')
    .select('role')
    .eq('classroom_id', access.classroom.id)
    .eq('student_id', studentId)
    .maybeSingle();
  if (
    targetEnrollment &&
    (targetEnrollment.role === 'instructor' || targetEnrollment.role === 'ta') &&
    access.role !== 'owner'
  ) {
    return NextResponse.json(
      { error: 'Only the classroom owner can remove a teaching role' },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from('classroom_enrollments')
    .delete()
    .eq('classroom_id', access.classroom.id)
    .eq('student_id', studentId);

  if (error) {
    return NextResponse.json({ error: 'Unable to remove student' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
