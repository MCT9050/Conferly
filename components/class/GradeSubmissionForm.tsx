"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type GradeResponse =
  | { submission: { id: string; score: number | null; feedback: string | null; graded_at: string | null } }
  | { error: string };

type Props = {
  assignmentId: string;
  submissionId: string;
  initialScore: number | null;
  initialFeedback: string | null;
};

/**
 * Teacher-facing inline grading form for one submission.
 * Mirrors SubmitAssignmentForm / AssignmentTeacherActions conventions:
 * pending guard, credentials-included fetch, error/success states,
 * router.refresh() so the server component re-reads authoritative data.
 */
export default function GradeSubmissionForm({
  assignmentId,
  submissionId,
  initialScore,
  initialFeedback,
}: Props) {
  const router = useRouter();
  const [score, setScore] = useState(initialScore === null ? '' : String(initialScore));
  const [feedback, setFeedback] = useState(initialFeedback ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setSuccess(null);

    // Mirror the database contract exactly: score is an integer between 0 and
    // 10000 or null (clearing the grade), feedback is free text up to 5000
    // characters or null.
    const rawScore = score.trim();
    let parsedScore: number | null = null;
    if (rawScore !== '') {
      parsedScore = Number(rawScore);
      if (!Number.isInteger(parsedScore) || parsedScore < 0 || parsedScore > 10000) {
        setError('Score must be an integer between 0 and 10000.');
        return;
      }
    }
    const trimmedFeedback = feedback.trim();
    if (trimmedFeedback.length > 5000) {
      setError('Feedback is too long (max 5000 characters).');
      return;
    }

    setPending(true);
    try {
      const response = await fetch(
        `/api/class/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: parsedScore, feedback: trimmedFeedback || null }),
        }
      );
      const result = (await response.json().catch(() => ({}))) as GradeResponse;
      if (!response.ok || 'error' in result) {
        setError('error' in result ? result.error : 'Unable to save grading.');
        return;
      }
      setSuccess('Grading saved.');
      router.refresh();
    } catch {
      setError('Unable to save grading.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-2 rounded-xl border border-white/10 bg-slate-950/60 p-3">
      <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
        <label className="block space-y-1 text-sm text-slate-200">
          <span>Score</span>
          <input
            type="number"
            min={0}
            max={10000}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            disabled={pending}
            placeholder="0–10000"
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block space-y-1 text-sm text-slate-200">
          <span>Feedback</span>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            maxLength={5000}
            disabled={pending}
            placeholder="Optional written feedback for the student…"
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </label>
      </div>
      {error && <div role="alert" className="text-sm text-red-300">{error}</div>}
      {success && <div role="status" className="text-sm text-emerald-300">{success}</div>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save grading'}
      </button>
    </form>
  );
}
