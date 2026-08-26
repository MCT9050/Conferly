"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type AssignmentResponse =
  | { id: string; title: string }
  | { error: string };

export default function CreateAssignmentForm({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Enter an assignment title.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/class/lessons/${encodeURIComponent(lessonId)}/assignments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmedTitle,
            instructions: instructions.trim() || undefined,
            due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
          }),
        }
      );
      const result = (await response.json().catch(() => ({}))) as AssignmentResponse;
      if (!response.ok || 'error' in result) {
        setError('error' in result ? result.error : 'Unable to create assignment.');
        return;
      }
      setTitle('');
      setInstructions('');
      setDueAt('');
      router.refresh();
    } catch {
      setError('Unable to create assignment.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 space-y-4">
      <h3 className="text-lg font-semibold text-white">Create assignment</h3>
      <label className="block text-sm text-slate-200" htmlFor={`assignment-title-${lessonId}`}>Title</label>
      <input
        id={`assignment-title-${lessonId}`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={200}
        disabled={pending}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
      />
      <label className="block text-sm text-slate-200" htmlFor={`assignment-instructions-${lessonId}`}>Instructions (optional)</label>
      <textarea
        id={`assignment-instructions-${lessonId}`}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        maxLength={5000}
        rows={4}
        disabled={pending}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
      />
      <label className="block text-sm text-slate-200" htmlFor={`assignment-due-${lessonId}`}>Due date (optional)</label>
      <input
        id={`assignment-due-${lessonId}`}
        type="datetime-local"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        disabled={pending}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
      />
      <div role="alert" aria-live="assertive" className="min-h-5 text-sm text-red-300">{error}</div>
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create Assignment'}
      </button>
    </form>
  );
}
