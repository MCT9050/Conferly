"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type LessonResponse = { error?: string };

export default function CreateLessonForm({ classroomId }: { classroomId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Enter a lesson title.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/class/classrooms/${encodeURIComponent(classroomId)}/lessons`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle, scheduled_at: scheduledAt || null }),
      });
      const result = (await response.json().catch(() => ({}))) as LessonResponse;
      if (!response.ok) {
        setError(result.error || 'Unable to create lesson.');
        return;
      }
      setTitle('');
      setScheduledAt('');
      router.refresh();
    } catch {
      setError('Unable to create lesson.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 space-y-4">
      <h2 className="text-lg font-semibold text-white">Create lesson</h2>
      <label className="block text-sm text-slate-200" htmlFor="lesson-title">Lesson title</label>
      <input id="lesson-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} disabled={pending} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
      <label className="block text-sm text-slate-200" htmlFor="lesson-scheduled-at">Scheduled time</label>
      <input id="lesson-scheduled-at" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} disabled={pending} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
      <div role="alert" aria-live="assertive" className="min-h-5 text-sm text-red-300">{error}</div>
      <button type="submit" disabled={pending || !title.trim()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Creating…' : 'Create Lesson'}</button>
    </form>
  );
}
