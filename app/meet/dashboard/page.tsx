// app/(meet)/dashboard/page.tsx
// Meet product home: upcoming meetings, schedule button, recent recordings.

import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function MeetDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Meetings</h1>
          <p className="text-sm text-slate-400">Professional video calls</p>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          New Meeting
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <p className="text-sm text-slate-400">No upcoming meetings. Schedule one to get started.</p>
      </div>
    </div>
  );
}