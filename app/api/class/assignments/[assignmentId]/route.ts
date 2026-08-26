import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import { verifyClassroomAccess, verifyClassroomTeachingAccess } from '@/lib/classroomAuth';
import { isUuid } from '@/lib/classValidation';

/**
 * GET /api/class/assignments/[assignmentId]
 *
 * Read a single assignment. Authorization:
 *   - Teaching roles (owner, instructor, ta) may read.
 *   - Enrolled students in active status may read.
 *
 * Response: { id, lesson_id, title, instructions, due_at, max_score, created_at,
 *             submissions: [{ student_id, score, submitted_at, graded_at }] (teaching only) }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const session = await getServerSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) {
    return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: assignment, error } = await supabase
    .from('classroom_assignments')
    .select('id, lesson_id, title, instructions, due_at, max_score, created_at, classroom_lessons!inner(classroom_id)')
    .eq('id', assignmentId)
    .maybeSingle();

  if (error) {
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
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Teaching roles see the full submissions list; students see only their own.
  const teaching = await verifyClassroomTeachingAccess(session.userId, classroomId);
  const { data: ownSubmission } = await supabase
    .from('classroom_submissions')
    .select('id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at')
    .eq('assignment_id', assignmentId)
    .eq('student_id', session.userId)
    .maybeSingle();

  if (teaching.granted) {
    const { data: submissions } = await supabase
      .from('classroom_submissions')
      .select('id, student_id, content, score, feedback, submitted_at, graded_at')
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false });
    // P4-4: a resubmission made after grading supersedes the recorded grade;
    // surface it instead of mutating the grade.
    return NextResponse.json({
      assignment: {
        id: assignment.id,
        lesson_id: assignment.lesson_id,
        title: assignment.title,
        instructions: assignment.instructions,
        due_at: assignment.due_at,
        max_score: assignment.max_score,
        created_at: assignment.created_at,
      },
      submissions: (submissions ?? []).map((s) => ({ ...s, is_stale: isStaleGrade(s) })),
      viewer_role: 'teacher',
    });
  }

  return NextResponse.json({
    assignment: {
      id: assignment.id,
      lesson_id: assignment.lesson_id,
      title: assignment.title,
      instructions: assignment.instructions,
      due_at: assignment.due_at,
      max_score: assignment.max_score,
      created_at: assignment.created_at,
    },
    submission: ownSubmission
      ? { ...ownSubmission, is_stale: isStaleGrade(ownSubmission) }
      : null,
    viewer_role: access.accessRole,
  });
}

/**
 * P4-4: true when the work was resubmitted after the grade was recorded,
 * meaning the stored grade refers to superseded content. Derived at read
 * time; never mutates grading columns.
 */
function isStaleGrade(row: { submitted_at?: string | null; graded_at?: string | null }): boolean {
  if (!row.graded_at || !row.submitted_at) return false;
  const graded = new Date(row.graded_at).getTime();
  const submitted = new Date(row.submitted_at).getTime();
  return !Number.isNaN(graded) && !Number.isNaN(submitted) && submitted > graded;
}

/**
 * Resolve an assignment to its parent classroom, or return an error response.
 * Shared by PATCH/DELETE so authorization always runs against the classroom.
 */
async function resolveAssignmentClassroom(
  assignmentId: string
): Promise<{ classroomId: string } | { errorResponse: NextResponse }> {
  const supabase = getSupabaseServerClient();
  const { data: assignment, error } = await supabase
    .from('classroom_assignments')
    .select('id, classroom_lessons!inner(classroom_id)')
    .eq('id', assignmentId)
    .maybeSingle();

  if (error) {
    return { errorResponse: NextResponse.json({ error: 'Unable to load assignment' }, { status: 500 }) };
  }
  if (!assignment) {
    return { errorResponse: NextResponse.json({ error: 'Assignment not found' }, { status: 404 }) };
  }

  const lessonRow = Array.isArray(assignment.classroom_lessons)
    ? assignment.classroom_lessons[0]
    : assignment.classroom_lessons;
  const classroomId = (lessonRow as { classroom_id?: string } | null)?.classroom_id;
  if (!classroomId) {
    return {
      errorResponse: NextResponse.json({ error: 'Assignment is not linked to a classroom' }, { status: 500 }),
    };
  }
  return { classroomId };
}

/** Shared field validation for assignment create/edit. */
function validateAssignmentFields(payload: {
  title: unknown;
  instructions: unknown;
  due_at: unknown;
  max_score: unknown;
}): { title: string; instructions: string | null; due_at: string | null; max_score: number } {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const instructions =
    typeof payload.instructions === 'string' && payload.instructions.trim()
      ? payload.instructions.trim().slice(0, 5000)
      : null;

  let dueAt: string | null = null;
  if (typeof payload.due_at === 'string' && payload.due_at.trim()) {
    const parsed = new Date(payload.due_at);
    if (!Number.isNaN(parsed.getTime())) dueAt = parsed.toISOString();
  }

  let maxScore = 100;
  if (typeof payload.max_score === 'number' && Number.isInteger(payload.max_score)) {
    if (payload.max_score >= 1 && payload.max_score <= 10000) maxScore = payload.max_score;
  }

  return { title, instructions, due_at: dueAt, max_score: maxScore };
}

/**
 * PATCH /api/class/assignments/[assignmentId]
 *
 * Edit an assignment. Teaching roles only (owner/instructor/ta).
 * Body: any subset of { title, instructions, due_at, max_score }.
 */
export async function PATCH(
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

  const resolved = await resolveAssignmentClassroom(assignmentId);
  if ('errorResponse' in resolved) return resolved.errorResponse;

  const access = await verifyClassroomTeachingAccess(session.userId, resolved.classroomId);
  if (!access.classroom) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  }
  if (!access.granted) {
    return NextResponse.json({ error: 'Only teaching roles can edit assignments' }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const editable =
    payload.title !== undefined ||
    payload.instructions !== undefined ||
    payload.due_at !== undefined ||
    payload.max_score !== undefined;
  if (!editable) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  const validated = validateAssignmentFields({
    title: payload.title ?? '',
    instructions: payload.instructions ?? '',
    due_at: payload.due_at ?? '',
    max_score: payload.max_score ?? undefined,
  });
  if (!validated.title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (validated.title.length > 200) {
    return NextResponse.json({ error: 'Title is too long (max 200 characters)' }, { status: 400 });
  }
  if (
    payload.due_at !== undefined &&
    typeof payload.due_at === 'string' &&
    payload.due_at.trim() &&
    Number.isNaN(new Date(payload.due_at).getTime())
  ) {
    return NextResponse.json({ error: 'due_at is invalid' }, { status: 400 });
  }
  if (
    payload.max_score !== undefined &&
    (typeof payload.max_score !== 'number' ||
      !Number.isInteger(payload.max_score) ||
      payload.max_score < 1 ||
      payload.max_score > 10000)
  ) {
    return NextResponse.json({ error: 'max_score must be between 1 and 10000' }, { status: 400 });
  }

  // Only apply the fields the caller actually sent.
  const updates: Record<string, unknown> = {};
  if (payload.title !== undefined) updates.title = validated.title;
  if (payload.instructions !== undefined) updates.instructions = validated.instructions;
  if (payload.due_at !== undefined) updates.due_at = validated.due_at;
  if (payload.max_score !== undefined) updates.max_score = validated.max_score;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('classroom_assignments')
    .update(updates)
    .eq('id', assignmentId)
    .select('id, lesson_id, title, instructions, due_at, max_score, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Unable to update assignment' }, { status: 500 });
  }
  return NextResponse.json(data);
}

/**
 * DELETE /api/class/assignments/[assignmentId]
 *
 * Delete an assignment. Teaching roles only. Submissions cascade at the
 * database level (classroom_submissions.assignment_id ON DELETE CASCADE).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const session = await getServerSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) {
    return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
  }

  const resolved = await resolveAssignmentClassroom(assignmentId);
  if ('errorResponse' in resolved) return resolved.errorResponse;

  const access = await verifyClassroomTeachingAccess(session.userId, resolved.classroomId);
  if (!access.classroom) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  }
  if (!access.granted) {
    return NextResponse.json({ error: 'Only teaching roles can delete assignments' }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('classroom_assignments').delete().eq('id', assignmentId);

  if (error) {
    return NextResponse.json({ error: 'Unable to delete assignment' }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}

