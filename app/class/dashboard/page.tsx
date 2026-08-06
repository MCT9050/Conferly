// app/(class)/dashboard/page.tsx
// Class product home: upcoming lessons, student activity, quick actions.

import { createSupabaseServerClient } from '@/lib/supabase/server';
import CreateClassroomButton from '@/components/CreateClassroomButton';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ClassDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const { create } = await searchParams;
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?product=class&redirect=%2Fclass%2Fdashboard');
  }

  const { data: classrooms, error } = await supabase
    .from('classrooms')
    .select('id, slug, title, subject, status, created_at, updated_at')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Classrooms</h1>
          <p className="text-sm text-slate-400">Teaching & learning</p>
        </div>
        <CreateClassroomButton autoOpen={create === '1'} />
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6" role="alert">
          <p className="text-sm text-amber-200">We could not load your classrooms. Please refresh and try again.</p>
        </div>
      ) : classrooms && classrooms.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classrooms.map((classroom) => (
            <Link
              key={classroom.id}
              href={`/class/classrooms/${encodeURIComponent(classroom.slug)}`}
              className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 transition hover:border-emerald-400/50 hover:bg-slate-900/70"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{classroom.title}</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">{classroom.status}</span>
              </div>
              {classroom.subject && <p className="mt-2 text-sm text-slate-300">{classroom.subject}</p>}
              <p className="mt-4 text-xs text-slate-500">
                Updated {new Date(classroom.updated_at ?? classroom.created_at ?? Date.now()).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
          <p className="text-sm text-slate-400">No classrooms yet. Create your first course to get started.</p>
        </div>
      )}
    </div>
  );
}
