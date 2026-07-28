"use client";

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateMeetingButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        meeting?: { slug?: string };
      };

      if (!response.ok || !payload.ok || !payload.meeting?.slug) {
        throw new Error(payload.error ?? 'Unable to create meeting. Please try again.');
      }

      router.push(`/lobby?room=${encodeURIComponent(payload.meeting.slug)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create meeting. Please try again.');
      setIsCreating(false);
    }
  }, [isCreating, router]);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isCreating}
        aria-busy={isCreating}
        data-testid="new-meeting-btn"
        className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isCreating ? 'Creating…' : 'New Meeting'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
