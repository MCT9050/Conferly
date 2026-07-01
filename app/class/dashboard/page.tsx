// app/(class)/dashboard/page.tsx
// Class product home: upcoming lessons, student activity, quick actions.

import { createSupabaseServerClient } from '@/lib/supabase/server';
import CreateClassroomButton from '@/components/CreateClassroomButton';

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
        <CreateClassroomButton />
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <p className="text-sm text-slate-400">No classrooms yet. Create your first course to get started.</p>
      </div>
    </div>
  );
}
