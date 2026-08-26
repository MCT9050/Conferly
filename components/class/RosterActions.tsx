"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RosterActions({
  classroomId,
  studentId,
  studentLabel,
}: {
  classroomId: string;
  studentId: string;
  studentLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (pending) return;
    if (!window.confirm(`Remove ${studentLabel} from this classroom?`)) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/class/classrooms/${encodeURIComponent(classroomId)}/enrollments`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId }),
        }
      );
      if (response.status !== 204 && !response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Unable to remove student.');
        return;
      }
      router.refresh();
    } catch {
      setError('Unable to remove student.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-lg border border-red-400/40 px-3 py-1 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-50"
      >
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {error && <span role="alert" className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
