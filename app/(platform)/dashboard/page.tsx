import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProductSelector, RecentActivityItem } from '@/components/platform/ProductSelector';

function sortByDate(a: RecentActivityItem, b: RecentActivityItem) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let recentActivity: RecentActivityItem[] = [];

  if (user?.id) {
    const [{ data: recentMeetings }, { data: recentClassrooms }] = await Promise.all([
      supabase
        .from('meetings')
        .select('id, title, created_at')
        .eq('owner', user.id)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('classrooms')
        .select('id, title, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    const mappedMeetings = (recentMeetings ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      type: 'meeting' as const,
      created_at: item.created_at,
    }));

    const mappedClassrooms = (recentClassrooms ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      type: 'classroom' as const,
      created_at: item.created_at,
    }));

    recentActivity = [...mappedMeetings, ...mappedClassrooms]
      .sort(sortByDate)
      .slice(0, 3);
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto py-12">
        <ProductSelector user={user} recentActivity={recentActivity} />
      </div>
    </main>
  );
}