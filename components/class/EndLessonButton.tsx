"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface EndResponse {
  error?: string;
}

// P4-2a: teaching-role-gated live -> completed transition.
// Authorizes server-side first; this component only issues the request.
export default function EndLessonButton({
  lessonId,
  redirectTo,
}: {
  lessonId: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function endLesson() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/class/lessons/${encodeURIComponent(lessonId)}/end`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.status === 403) {
        setError('You do not have permission to end this lesson.');
        return;
      }
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as EndResponse;
        setError(result.error || 'Unable to end lesson.');
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch {
      setError('Unable to end lesson.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={endLesson} disabled={pending} className="rounded-lg border border-rose-500/30 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">
        {pending ? 'Ending…' : 'End Lesson'}
      </button>
      <span role="alert" aria-live="assertive" className="text-xs text-red-300">{error}</span>
    </div>
  );
}
