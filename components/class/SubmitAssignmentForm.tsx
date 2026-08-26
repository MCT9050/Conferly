"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type SubmissionResponse =
  | { submission: { id: string; content: unknown; submitted_at: string } }
  | { error: string };

type Props = {
  assignmentId: string;
  initialText?: string;
};

export default function SubmitAssignmentForm({ assignmentId, initialText }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialText ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Enter your answer before submitting.');
      return;
    }
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/class/assignments/${encodeURIComponent(assignmentId)}/submissions`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { text: trimmed } }),
        }
      );
      const result = (await response.json().catch(() => ({}))) as SubmissionResponse;
      if (!response.ok || 'error' in result) {
        setError('error' in result ? result.error : 'Unable to submit assignment.');
        return;
      }
      setSuccess('Submission saved.');
      router.refresh();
    } catch {
      setError('Unable to submit assignment.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/50 p-5">
      <h3 className="text-lg font-semibold text-white">Your submission</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={20000}
        disabled={pending}
        placeholder="Write your answer here…"
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
      />
      {error && <div role="alert" className="text-sm text-red-300">{error}</div>}
      {success && <div role="status" className="text-sm text-emerald-300">{success}</div>}
      <button
        type="submit"
        disabled={pending || !text.trim()}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Submitting…' : initialText ? 'Update submission' : 'Submit'}
      </button>
    </form>
  );
}
