"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type LaunchResponse = { joinUrl?: string; error?: string };

export default function LaunchLessonButton({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/class/lessons/${encodeURIComponent(lessonId)}/launch`, {
        method: 'POST',
        credentials: 'include',
      });
      const result = (await response.json().catch(() => ({}))) as LaunchResponse;
      if (!response.ok || !result.joinUrl) {
        setError(result.error || 'Unable to launch lesson.');
        return;
      }
      router.push(result.joinUrl);
    } catch {
      setError('Unable to launch lesson.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={launch} disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm hover:bg-emerald-700 disabled:opacity-50">
        {pending ? 'Launching…' : 'Launch Lesson'}
      </button>
      <span role="alert" aria-live="assertive" className="text-xs text-red-300">{error}</span>
    </div>
  );
}