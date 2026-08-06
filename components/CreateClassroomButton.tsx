"use client";

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CLASS_ENROLLMENT_TYPES, type ClassEnrollmentType } from '@/lib/classValidation';

type Props = { autoOpen?: boolean };
type ApiResponse = { slug?: string; error?: string };

export default function CreateClassroomButton({ autoOpen = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [enrollmentType, setEnrollmentType] = useState<ClassEnrollmentType>('open');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (open) window.setTimeout(() => titleRef.current?.focus(), 0);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Enter a classroom title.');
      titleRef.current?.focus();
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/class/classrooms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          subject: subject.trim() || null,
          description: description.trim() || null,
          enrollment_type: enrollmentType,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok || !result.slug) {
        setError(result.error || 'Unable to create the classroom. Please try again.');
        return;
      }
      router.refresh();
      router.push(`/class/classrooms/${encodeURIComponent(result.slug)}`);
    } catch {
      setError('Unable to create the classroom. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(true)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors" data-testid="create-classroom-btn">
        Create Classroom
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="create-classroom-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="create-classroom-title" className="text-xl font-semibold text-white">Create classroom</h2>
                <p className="mt-1 text-sm text-slate-400">Add the title now. Lessons are created separately.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-white/10" aria-label="Close classroom creation form">×</button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-200" htmlFor="classroom-title">Title *</label>
              <input ref={titleRef} id="classroom-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required disabled={pending} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-400" />
              <label className="block text-sm font-medium text-slate-200" htmlFor="classroom-subject">Subject</label>
              <input id="classroom-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={80} disabled={pending} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-400" />
              <label className="block text-sm font-medium text-slate-200" htmlFor="classroom-description">Description</label>
              <textarea id="classroom-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} disabled={pending} rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-400" />
              <label className="block text-sm font-medium text-slate-200" htmlFor="classroom-enrollment">Enrollment type</label>
              <select id="classroom-enrollment" value={enrollmentType} onChange={(event) => setEnrollmentType(event.target.value as ClassEnrollmentType)} disabled={pending} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-400">
                {CLASS_ENROLLMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="mt-4 min-h-6 text-sm text-red-300" role="alert" aria-live="assertive">{error}</div>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">Cancel</button>
              <button type="submit" disabled={pending || !title.trim()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Creating…' : 'Create classroom'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}