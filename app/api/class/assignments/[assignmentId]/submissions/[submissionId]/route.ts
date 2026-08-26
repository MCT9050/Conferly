import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import { verifyClassroomTeachingAccess } from '@/lib/classroomAuth';
import { isUuid } from '@/lib/classValidation';

/**
 * PATCH /api/class/assignments/[assignmentId]/submissions/[submissionId]
 *
 * Grade (re-grade, or clear the grade of) one student submission.
 * Teaching roles only (owner/instructor/ta); students are rejected with 403.
 *
 * Authorization chain: session -> resolve submission + parent assignment +
 * parent classroom in one query -> verifyClassroomTeachingAccess(classroomId).
 * The UPDATE itself is additionally scoped with
 * `eq(id, submissionId) + eq(assignment_id, assignmentId)` so writes can never
 * cross assignments even under concurrent mutation.
 *
 * Body: any subset of
 *   { score?: number | null, feedback?: string | null }
 * - score: integer 0..10000 (mirrors the DB CHECK) or null to clear the grade.
 *   Providing a non-null score stamps graded_at = now(); null clears it.
 *   Feedback-only updates leave graded_at untouched.
 * - feedback: free text (<= 5000 chars, mirrors the DB CHECK) or null to clear.
 *
 * Concurrency: the UPDATE takes a row lock; concurrent teacher grades
 * serialize last-write-wins, and a student resubmission (which touches only
 * `content`) cannot clobber grading columns. A submission deleted between the
 * existence check and the UPDATE surfaces as 404 via the empty update result.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string; submissionId: string }> }
) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { assignmentId, submissionId } = await params;
  if (!isUuid(assignmentId)) {
    return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
  }
  if (!isUuid(submissionId)) {
    return NextResponse.json({ error: 'Invalid submission id' }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const validated = validateGradingPayload(payload);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  // Resolve the submission together with its parent assignment and classroom
  // so authorization always runs against the owning classroom.
  const { data: row, error } = await supabase
    .from('classroom_submissions')
    .select(
      'id, student_id, classroom_assignments!inner(id, lesson_id, classroom_lessons!inner(classroom_id))'
    )
    .eq('id', submissionId)
    .eq('assignment_id', assignmentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Unable to load submission' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  type EmbeddedAssignment = {
    lesson_id?: string;
    classroom_lessons: { classroom_id: string } | { classroom_id: string }[];
  };
  // The PostgREST client types object embeds as arrays at the type level while
  // the runtime shape follows the requested resource; normalize through unknown.
  const embedded = row.classroom_assignments as unknown as EmbeddedAssignment | null;
  const lessons = Array.isArray(embedded?.classroom_lessons)
    ? embedded?.classroom_lessons[0]
    : embedded?.classroom_lessons;
  const classroomId = lessons?.classroom_id;
  if (!classroomId) {
    return NextResponse.json({ error: 'Submission is not linked to a classroom' }, { status: 500 });
  }

  const access = await verifyClassroomTeachingAccess(session.userId, classroomId);
  if (!access.classroom) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  }
  if (!access.granted) {
    return NextResponse.json({ error: 'Only teaching roles can grade submissions' }, { status: 403 });
  }

  const { data: updated, error: updateError } = await supabase
    .from('classroom_submissions')
    .update(validated.updates)
    .eq('id', submissionId)
    .eq('assignment_id', assignmentId)
    .select('id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at')
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: 'Unable to save grading' }, { status: 500 });
  }
  if (!updated) {
    // Deleted between the existence check and the update.
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  return NextResponse.json({ submission: updated });
}

/** Shared grading-payload validation mirroring the database constraints. */
function validateGradingPayload(
  payload: Record<string, unknown>
): { ok: true; updates: Record<string, unknown> } | { ok: false; error: string } {
  const hasScore = payload.score !== undefined;
  const hasFeedback = payload.feedback !== undefined;
  if (!hasScore && !hasFeedback) {
    return { ok: false, error: 'Provide score and/or feedback' };
  }

  const updates: Record<string, unknown> = {};

  if (hasScore) {
    if (payload.score === null) {
      // Explicitly clearing the grade also clears graded_at.
      updates.score = null;
      updates.graded_at = null;
    } else if (
      typeof payload.score === 'number' &&
      Number.isInteger(payload.score) &&
      payload.score >= 0 &&
      payload.score <= 10000
    ) {
      updates.score = payload.score;
      updates.graded_at = new Date().toISOString();
    } else {
      return {
        ok: false,
        error: 'Score must be an integer between 0 and 10000, or null to clear the grade',
      };
    }
  }

  if (hasFeedback) {
    if (payload.feedback === null) {
      updates.feedback = null;
    } else if (typeof payload.feedback === 'string') {
      const trimmed = payload.feedback.trim();
      if (trimmed.length > 5000) {
        return { ok: false, error: 'Feedback is too long (max 5000 characters)' };
      }
      updates.feedback = trimmed ? trimmed : null;
    } else {
      return { ok: false, error: 'Feedback must be text or null' };
    }
  }

  return { ok: true, updates };
}
