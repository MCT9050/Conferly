// app/meet/dashboard/page.tsx
// Meet product workspace: create meetings, join by code, view recent meetings.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import CreateMeetingButton from '@/components/CreateMeetingButton';
import JoinExistingMeeting from '@/components/meet/JoinExistingMeeting';

export const dynamic = 'force-dynamic';

export default async function MeetDashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?product=meet&redirect=%2Fmeet%2Fdashboard');
  }

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, slug, title, created_at, is_public')
    .eq('owner', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meet Dashboard</h1>
          <p className="text-sm text-slate-400">Create and join video meetings</p>
        </div>
        <CreateMeetingButton />
      </div>

      <JoinExistingMeeting />

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Your recent meetings</h2>

        {error ? (
          <div
            className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6"
            role="alert"
          >
            <p className="text-sm text-amber-200">
              Unable to load your meetings. Please refresh to try again.
            </p>
          </div>
        ) : meetings && meetings.length > 0 ? (
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/meet/rooms/${encodeURIComponent(meeting.slug)}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/40 p-4 transition hover:border-blue-500/30 hover:bg-slate-900/70"
              >
                <div>
                  <h3 className="font-medium text-white">
                    {meeting.title || meeting.slug}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {meeting.created_at
                      ? new Date(meeting.created_at).toLocaleDateString()
                      : ''}
                  </p>
                </div>

                <span className="text-xs text-blue-400">Open →</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
            <p className="text-sm text-slate-400">
              No meetings yet. Create your first meeting to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
