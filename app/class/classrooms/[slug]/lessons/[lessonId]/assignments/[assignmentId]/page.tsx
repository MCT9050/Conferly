import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import {
  resolveClassroom,
  verifyClassroomAccess,
  verifyClassroomTeachingAccess,
} from '@/lib/classroomAuth';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import SubmitAssignmentForm from '@/components/class/SubmitAssignmentForm';
import AssignmentTeacherActions from '@/components/class/AssignmentTeacherActions';
import GradeSubmissionForm from '@/components/class/GradeSubmissionForm';

type SubmissionContentText = { text?: string };

function extractSubmissionText(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const text = (content as SubmissionContentText).text;
  return typeof text === 'string' ? text : '';
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
}

/** P4-4: work was resubmitted after grading — the shown grade is stale. */
function submissionIsStale(row: {
  submitted_at?: string | null;
  graded_at?: string | null;
}): boolean {
  if (!row.graded_at || !row.submitted_at) return false;
  const graded = new Date(row.graded_at).getTime();
  const submitted = new Date(row.submitted_at).getTime();
  return !Number.isNaN(graded) && !Number.isNaN(submitted) && submitted > graded;
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string; assignmentId: string }>;
}) {
  const { slug, lessonId, assignmentId } = await params;
  const session = await getServerSession();
  if (!session?.userId) redirect(`/auth?redirect=/class/classrooms/${slug}/lessons/${lessonId}/assignments/${assignmentId}`);

  const classroom = await resolveClassroom(slug);
  if (!classroom) notFound();
  const access = await verifyClassroomAccess(session.userId, slug);
  if (!access.granted) redirect('/class/dashboard');
  const teaching = await verifyClassroomTeachingAccess(session.userId, slug);
  const isTeacher = teaching.granted;
  const canonicalSlug = classroom.slug;

  const supabase = getSupabaseServerClient();
  const { data: assignment, error } = await supabase
    .from('classroom_assignments')
    .select('id, lesson_id, title, instructions, due_at, max_score, created_at')
    .eq('id', assignmentId)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-amber-200">Unable to load assignment.</div>
    );
  }
  if (!assignment) notFound();

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <Link
        href={`/class/classrooms/${canonicalSlug}/lessons/${lessonId}/assignments`}
        className="text-sm text-slate-400 hover:text-white"
      >
        ← Back to assignments
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-white">{assignment.title}</h1>
        <p className="text-sm text-slate-400">
          Due {formatDateTime(assignment.due_at)} · Max score {assignment.max_score}
        </p>
      </div>

      {assignment.instructions && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-slate-100 whitespace-pre-wrap">
          {assignment.instructions}
        </div>
      )}

      {isTeacher && (
        <AssignmentTeacherActions
          assignmentId={assignmentId}
          backHref={`/class/classrooms/${canonicalSlug}/lessons/${lessonId}/assignments`}
          initial={{
            title: assignment.title,
            instructions: assignment.instructions,
            due_at: assignment.due_at,
            max_score: assignment.max_score ?? 100,
          }}
        />
      )}

      {isTeacher ? (
        <TeacherSubmissionsList assignmentId={assignmentId} />
      ) : (
        <StudentSubmissionBlock
          assignmentId={assignmentId}
          studentId={session.userId}
        />
      )}
    </div>
  );
}

async function TeacherSubmissionsList({ assignmentId }: { assignmentId: string }) {
  const supabase = getSupabaseServerClient();
  const { data: submissions, error } = await supabase
    .from('classroom_submissions')
    .select('id, student_id, content, score, feedback, submitted_at, graded_at')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200">
        Unable to load submissions.
      </div>
    );
  }
  if (!submissions || submissions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-400">
        No submissions yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-white">Submissions</h2>
      {submissions.map((s) => (
        <div key={s.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-slate-200">
          <div className="text-sm text-slate-400">
            Student {s.student_id.slice(0, 8)}… · Submitted {formatDateTime(s.submitted_at)}
            {s.graded_at ? ` · Graded ${formatDateTime(s.graded_at)}` : ''}
            {typeof s.score === 'number' ? ` · Score ${s.score}` : ''}
          </div>
          {submissionIsStale(s) && (
            <div className="mt-2 inline-block rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
              Resubmitted after grading — score refers to the earlier submission
            </div>
          )}
          <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-950 p-3 text-sm text-slate-100">
            {extractSubmissionText(s.content) || '(no text content)'}
          </pre>
          {typeof s.feedback === 'string' && s.feedback && (
            <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-emerald-300">Saved feedback</div>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-emerald-50">{s.feedback}</pre>
            </div>
          )}
          <GradeSubmissionForm
            assignmentId={assignmentId}
            submissionId={s.id}
            initialScore={typeof s.score === 'number' ? s.score : null}
            initialFeedback={typeof s.feedback === 'string' ? s.feedback : null}
          />
        </div>
      ))}
    </div>
  );
}

async function StudentSubmissionBlock({
  assignmentId,
  studentId,
}: {
  assignmentId: string;
  studentId: string;
}) {
  const supabase = getSupabaseServerClient();
  const { data: submission } = await supabase
    .from('classroom_submissions')
    .select('id, content, score, feedback, submitted_at, graded_at')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (submission) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <div className="text-sm text-slate-400">
            Submitted {formatDateTime(submission.submitted_at)}
            {submission.graded_at ? ` · Graded ${formatDateTime(submission.graded_at)}` : ''}
            {typeof submission.score === 'number' ? ` · Score ${submission.score}` : ''}
          </div>
          {submissionIsStale(submission) && (
            <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              You resubmitted this work after it was graded — the score and feedback above apply to your earlier submission.
            </div>
          )}
          <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-950 p-3 text-sm text-slate-100">
            {extractSubmissionText(submission.content) || '(no text content)'}
          </pre>
          {typeof submission.feedback === 'string' && submission.feedback && (
            <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-emerald-300">Teacher feedback</div>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-emerald-50">{submission.feedback}</pre>
            </div>
          )}
        </div>
        <SubmitAssignmentForm
          assignmentId={assignmentId}
          initialText={extractSubmissionText(submission.content)}
        />
      </div>
    );
  }

  return <SubmitAssignmentForm assignmentId={assignmentId} />;
}
