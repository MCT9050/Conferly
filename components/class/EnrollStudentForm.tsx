"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type StudentResult = {
  id: string;
  email: string | null;
  display_name: string;
  full_name: string | null;
  enrolled: boolean;
};

type CapacityInfo = {
  student_count: number;
  student_limit: number;
  teacher_count: number;
  teacher_limit: number;
  plan: string;
};

type EnrollResponse =
  | {
      enrollment: { id: string };
      already_enrolled?: boolean;
      capacity?: CapacityInfo;
      capacity_warning?: string;
    }
  | { error: string };

type LookupResponse = { results?: StudentResult[] } | { error?: string };

function resultLabel(result: StudentResult): string {
  const name = result.full_name?.trim() || result.display_name?.trim() || 'Unnamed user';
  return result.email ? `${name} (${result.email})` : name;
}

export default function EnrollStudentForm({ classroomId }: { classroomId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [role, setRole] = useState<'student' | 'auditor' | 'instructor' | 'ta'>('student');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [capacityNote, setCapacityNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Lightweight lookup: debounce input, hit the teaching-gated GET endpoint.
  const runSearch = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      abortRef.current?.abort();
      if (trimmed.length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const response = await fetch(
          `/api/class/classrooms/${encodeURIComponent(classroomId)}/enrollments?q=${encodeURIComponent(trimmed)}`,
          { credentials: 'include', signal: controller.signal }
        );
        const data = (await response.json().catch(() => ({}))) as LookupResponse;
        if (controller.signal.aborted) return;
        const found = data && typeof data === 'object' && 'results' in data ? data.results : undefined;
        setResults(!response.ok || !Array.isArray(found) ? [] : found);
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    },
    [classroomId]
  );

  useEffect(() => {
    const timer = setTimeout(() => void runSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function enroll(result: StudentResult) {
    if (pendingId) return;
    setPendingId(result.id);
    setError(null);
    setSuccess(null);
    setWarning(null);
    setCapacityNote(null);
    try {
      const response = await fetch(
        `/api/class/classrooms/${encodeURIComponent(classroomId)}/enrollments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: result.id, role }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as EnrollResponse;
      if (!response.ok || 'error' in data) {
        setError('error' in data ? data.error : 'Unable to enroll student.');
        return;
      }
      setSuccess(
        data.already_enrolled
          ? `${resultLabel(result)} is already enrolled.`
          : `${resultLabel(result)} enrolled.`
      );
      if (data.capacity_warning) setWarning(data.capacity_warning);
      if (data.capacity && role !== 'instructor' && role !== 'ta') {
        setCapacityNote(
          `${data.capacity.student_count} of ${data.capacity.student_limit} student seats used (${data.capacity.plan}).`
        );
      }
      // Refresh the roster and re-run the lookup so the row flips to
      // "already enrolled" state.
      router.refresh();
      void runSearch(query);
    } catch {
      setError('Unable to enroll student.');
    } finally {
      setPendingId(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 space-y-4">
      <h2 className="text-lg font-semibold text-white">Enroll a student</h2>
      <p className="text-xs text-slate-400">
        Search by the student&apos;s email or name, then pick the right person from the results.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="space-y-1 text-sm text-slate-200">
          <span className="block">Email or name</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. sam@example.com or Sam Lee"
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            autoComplete="off"
            disabled={pendingId !== null}
          />
        </label>
        <label className="space-y-1 text-sm text-slate-200">
          <span className="block">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
            disabled={pendingId !== null}
          >
            <option value="student">Student</option>
            <option value="auditor">Auditor</option>
            <option value="ta">Teaching assistant</option>
            <option value="instructor">Instructor</option>
          </select>
        </label>
      </div>

      {query.trim().length >= 2 && (
        <div className="space-y-2">
          {searching && <div className="text-sm text-slate-400">Searching…</div>}
          {!searching && results.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
              No matching students found. Ask them to sign up first, then search again.
            </div>
          )}
          {!searching &&
            results.map((result) => (
              <div
                key={result.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-100">{resultLabel(result)}</div>
                  {result.enrolled && <div className="text-xs text-emerald-300">Already on the roster</div>}
                </div>
                <button
                  type="button"
                  onClick={() => void enroll(result)}
                  disabled={result.enrolled || pendingId !== null}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingId === result.id ? 'Enrolling…' : 'Enroll'}
                </button>
              </div>
            ))}
        </div>
      )}

      {error && <div role="alert" className="text-sm text-red-300">{error}</div>}
      {warning && <div role="alert" className="text-sm text-amber-300">{warning}</div>}
      {capacityNote && !warning && <div role="status" className="text-sm text-slate-400">{capacityNote}</div>}
      {success && <div role="status" className="text-sm text-emerald-300">{success}</div>}
    </form>
  );
}

