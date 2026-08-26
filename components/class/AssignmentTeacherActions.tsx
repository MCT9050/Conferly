"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type AssignmentPatch =
  | { id: string; title: string }
  | { error: string };

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AssignmentTeacherActions({
  assignmentId,
  backHref,
  initial,
}: {
  assignmentId: string;
  backHref: string;
  initial: {
    title: string;
    instructions: string | null;
    due_at: string | null;
    max_score: number;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initial.title);
  const [instructions, setInstructions] = useState(initial.instructions ?? '');
  const [dueAt, setDueAt] = useState(isoToLocalInput(initial.due_at));
  const [maxScore, setMaxScore] = useState(String(initial.max_score));
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Enter an assignment title.');
      return;
    }
    setPending('save');
    setError(null);
    try {
      const response = await fetch(`/api/class/assignments/${encodeURIComponent(assignmentId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          instructions: instructions.trim() || null,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          max_score: maxScore.trim() === '' ? undefined : Number(maxScore),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as AssignmentPatch;
      if (!response.ok || 'error' in data) {
        setError('error' in data ? data.error : 'Unable to update assignment.');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Unable to update assignment.');
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (pending) return;
    if (!window.confirm('Delete this assignment? All submissions will be removed as well.')) return;
    setPending('delete');
    setError(null);
    try {
      const response = await fetch(`/api/class/assignments/${encodeURIComponent(assignmentId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok && response.status !== 204) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Unable to delete assignment.');
        return;
      }
      router.push(backHref);
      router.refresh();
    } catch {
      setError('Unable to delete assignment.');
    } finally {
      setPending(null);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-1">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={pending !== null}
            className="rounded-lg border border-red-400/40 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-50"
          >
            {pending === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
        </div>
        {error && <div role="alert" className="text-sm text-red-300">{error}</div>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 space-y-4">
      <h2 className="text-lg font-semibold text-white">Edit assignment</h2>
      <label className="block space-y-1 text-sm text-slate-200">
        <span>Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
          disabled={pending !== null}
          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <label className="block space-y-1 text-sm text-slate-200">
        <span>Instructions</span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={4}
          maxLength={5000}
          disabled={pending !== null}
          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm text-slate-200">
          <span>Due date</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            disabled={pending !== null}
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block space-y-1 text-sm text-slate-200">
          <span>Max score</span>
          <input
            type="number"
            min={1}
            max={10000}
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            disabled={pending !== null}
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </label>
      </div>
      {error && <div role="alert" className="text-sm text-red-300">{error}</div>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending !== null}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending === 'save' ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
            setTitle(initial.title);
            setInstructions(initial.instructions ?? '');
            setDueAt(isoToLocalInput(initial.due_at));
            setMaxScore(String(initial.max_score));
          }}
          disabled={pending !== null}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
