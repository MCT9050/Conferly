// app/(class)/dashboard/page.tsx
// Class product home: upcoming lessons, student activity, quick actions.

import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function ClassDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Classrooms</h1>
          <p className="text-sm text-slate-400">Teaching & learning</p>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
        >
          Create Classroom
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <p className="text-sm text-slate-400">No classrooms yet. Create your first course to get started.</p>
      </div>
    </div>
  );
}