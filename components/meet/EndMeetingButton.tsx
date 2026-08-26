"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// P4-2b host end-action. Only rendered for the meeting owner. Shares the same
// authoritative persistence path as the LiveKit webhook receiver.
export default function EndMeetingButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function endMeeting() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/end`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.status === 403) {
        setError('Only the meeting owner can end the meeting.');
        return;
      }
      if (!response.ok) {
        const result = (await response.json().catch(() => ({ error: 'Unable to end meeting.' }))) as { error?: string };
        setError(result.error || 'Unable to end meeting.');
        return;
      }
      // Terminated — return to the cross-product dashboard.
      router.push('/dashboard');
    } catch {
      setError('Unable to end meeting.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={endMeeting}
        disabled={pending}
        className="rounded-lg border border-rose-500/30 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
      >
        {pending ? 'Ending…' : 'End Meeting'}
      </button>
      <span role="alert" aria-live="assertive" className="text-xs text-red-300">{error}</span>
    </div>
  );
}
