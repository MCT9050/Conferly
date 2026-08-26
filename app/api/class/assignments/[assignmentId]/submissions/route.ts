import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import { verifyClassroomAccess } from '@/lib/classroomAuth';
import { isUuid } from '@/lib/classValidation';

/**
 * POST /api/class/assignments/[assignmentId]/submissions
 *
 * Submit (or update) the caller's submission for an assignment.
 * Database enforces UNIQUE(assignment_id, student_id); concurrent duplicate
 * submissions are serialized and the second becomes an update.
 *
 * Authorization: caller must be enrolled in the assignment's classroom in an
 * active status AND hold the 'student' enrollment role (P4-3). Owners,
 * instructors, TAs and auditors are rejected: auditors are read-only and
 * teaching roles have no submission of their own to make.
 *
 * Body: { content: object | string }
 *
 * Responses:
 *   201 { submission: {...} }   (new)
 *   200 { submission: {...} }   (updated, idempotent)
 *   400 invalid input
 *   401 unauthenticated
 *   403 not enrolled
 *   404 assignment not found
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) {
    return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // content can be a string (text answer) or any JSON object. We persist the
  // raw value inside a jsonb column.
  const content = payload.content;
  if (content === undefined || content === null) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }
  const normalizedContent =
    typeof content === 'string'
      ? { text: content }
      : (content as Record<string, unknown>);

  const supabase = getSupabaseServerClient();

  // Look up assignment + parent classroom.
  const { data: assignment, error: aErr } = await supabase
    .from('classroom_assignments')
    .select('id, classroom_lessons!inner(classroom_id)')
    .eq('id', assignmentId)
    .maybeSingle();

  if (aErr) {
    return NextResponse.json({ error: 'Unable to load assignment' }, { status: 500 });
  }
  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  const lessonRow = Array.isArray(assignment.classroom_lessons)
    ? assignment.classroom_lessons[0]
    : assignment.classroom_lessons;
  const classroomId = (lessonRow as { classroom_id?: string } | null)?.classroom_id;
  if (!classroomId) {
    return NextResponse.json({ error: 'Assignment is not linked to a classroom' }, { status: 500 });
  }

  const access = await verifyClassroomAccess(session.userId, classroomId);
  if (!access.granted) {
    return NextResponse.json({ error: 'Only enrolled students can submit' }, { status: 403 });
  }
  // P4-3: submission is a student-only action. Teaching roles resolve here
  // with accessRole 'instructor' (owner included); auditors stay read-only.
  if (access.accessRole !== 'student') {
    return NextResponse.json({ error: 'Only enrolled students can submit' }, { status: 403 });
  }

  // Idempotent upsert on UNIQUE(assignment_id, student_id). The DB constraint
  // ensures concurrent submissions for the same (assignment, student) collapse
  // into a single row.
  const { data, error } = await supabase
    .from('classroom_submissions')
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: session.userId,
        content: normalizedContent,
      },
      { onConflict: 'assignment_id,student_id' }
    )
    .select('id, assignment_id, student_id, content, score, submitted_at, graded_at')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Unable to submit assignment' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Unable to submit assignment' }, { status: 500 });
  }

  return NextResponse.json({ submission: data }, { status: 200 });
}
