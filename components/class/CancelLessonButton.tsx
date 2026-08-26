"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CancelResponse {
  error?: string;
}

// P4-2a: teaching-role-gated scheduled -> cancelled transition.
// Authorizes server-side first; this component only issues the request.
export default function CancelLessonButton({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/class/lessons/${encodeURIComponent(lessonId)}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.status === 403) {
        setError('You do not have permission to cancel this lesson.');
        return;
      }
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as CancelResponse;
        setError(result.error || 'Unable to cancel lesson.');
        return;
      }
      router.refresh();
    } catch {
      setError('Unable to cancel lesson.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={cancel} disabled={pending} className="rounded-lg border border-amber-500/30 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50">
        {pending ? 'Cancelling…' : 'Cancel Lesson'}
      </button>
      <span role="alert" aria-live="assertive" className="text-xs text-red-300">{error}</span>
    </div>
  );
}
