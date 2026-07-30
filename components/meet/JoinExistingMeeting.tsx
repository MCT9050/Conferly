"use client";

import { useCallback, useState } from "react";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { normalizeMeetingJoinTarget } from "@/lib/meetingInvite";

export default function JoinExistingMeeting() {
  const router = useRouter();
  const [locator, setLocator] = useState("");
  const [error, setError] = useState<string | null>(null);

  const joinMeeting = useCallback(() => {
    setError(null);
    const target = normalizeMeetingJoinTarget(locator, window.location.origin);

    if (!target.ok) {
      setError(target.error);
      return;
    }

    router.push(target.href);
  }, [locator, router]);

  return (
    <section
      className="rounded-2xl border border-white/10 bg-slate-900/40 p-6"
      aria-labelledby="join-existing-meeting-heading"
    >
      <h2 id="join-existing-meeting-heading" className="text-lg font-semibold text-white">
        Join an existing meeting
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Enter a secure invitation link, meeting link, or meeting code. A private
        room code is only a locator and does not grant access by itself.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={locator}
          onChange={(event) => setLocator(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") joinMeeting();
          }}
          placeholder="Meeting link or code"
          aria-label="Meeting link or code"
          maxLength={512}
          className="min-w-0 flex-1 rounded-xl border border-slate-700/40 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={joinMeeting}
          disabled={!locator.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LogIn className="h-4 w-4" />
          Join meeting
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}