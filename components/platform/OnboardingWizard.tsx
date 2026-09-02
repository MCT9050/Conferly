'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, BookOpen, Loader2, ArrowRight } from 'lucide-react';
import type { MeetIntent, ClassIntent } from '@/lib/onboarding';

interface OnboardingWizardProps {
  initialMeetIntent?: MeetIntent | null;
  initialClassIntent?: ClassIntent | null;
}

export default function OnboardingWizard({
  initialMeetIntent = null,
  initialClassIntent = null,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [meetIntent, setMeetIntent] = useState<MeetIntent | null>(initialMeetIntent);
  const [classIntent, setClassIntent] = useState<ClassIntent | null>(initialClassIntent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(skipped = false) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetIntent: skipped ? null : meetIntent,
          classIntent: skipped ? null : classIntent,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save onboarding preferences');
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  const canContinue = meetIntent !== null || classIntent !== null;

  return (
    <div className="w-full max-w-xl space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold">What do you want to use Conferly for?</h1>
        <p className="text-sm text-slate-400">Select one or more options. You can always change this later.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Video className="w-4 h-4 text-blue-400" /> Conferly Meet
        </div>
        <div className="grid grid-cols-2 gap-3">
          <IntentButton
            label="Host meetings"
            description="Create and run video meetings"
            selected={meetIntent === 'host'}
            onClick={() => setMeetIntent((p) => (p === 'host' ? null : 'host'))}
            color="blue"
          />
          <IntentButton
            label="Attend meetings"
            description="Join video meetings"
            selected={meetIntent === 'attend'}
            onClick={() => setMeetIntent((p) => (p === 'attend' ? null : 'attend'))}
            color="blue"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <BookOpen className="w-4 h-4 text-emerald-400" /> Conferly Class
        </div>
        <div className="grid grid-cols-2 gap-3">
          <IntentButton
            label="Teach"
            description="Create classrooms and lessons"
            selected={classIntent === 'teacher'}
            onClick={() => setClassIntent((p) => (p === 'teacher' ? null : 'teacher'))}
            color="emerald"
          />
          <IntentButton
            label="Learn"
            description="Join classrooms as a student"
            selected={classIntent === 'student'}
            onClick={() => setClassIntent((p) => (p === 'student' ? null : 'student'))}
            color="emerald"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={submitting}
          className="px-5 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-medium hover:bg-white/5 transition-all disabled:opacity-50"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={!canContinue || submitting}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}

function IntentButton({
  label,
  description,
  selected,
  onClick,
  color,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  color: 'blue' | 'emerald';
}) {
  const active = color === 'blue'
    ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
    : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300';
  const inactive = 'border-white/10 bg-slate-900/40 text-slate-400 hover:border-white/20';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${selected ? active : inactive}`}
    >
      <span className="block text-base font-semibold mb-0.5">{label}</span>
      {description}
    </button>
  );
}
