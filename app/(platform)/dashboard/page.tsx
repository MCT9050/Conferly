import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProductSelector } from '@/components/platform/ProductSelector';
import type { RecentWorkspaceItem } from '@/lib/recentWorkspace';

function sortByDate(a: RecentWorkspaceItem, b: RecentWorkspaceItem) {
  return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let recentActivity: RecentWorkspaceItem[] = [];

  if (user?.id) {
    const [{ data: recentMeetings }, { data: recentClassrooms }] = await Promise.all([
      supabase
        .from('meetings')
        .select('id, slug, room_code, title, created_at')
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
      resourceId: item.id,
      routeSlug: item.slug?.trim() || item.room_code?.trim() || null,
      title: item.title,
      displayLabel: item.title || item.slug || item.room_code || 'Untitled meeting',
      type: 'meet' as const,
      createdAt: item.created_at,
    }));

    const mappedClassrooms = (recentClassrooms ?? []).map((item) => ({
      resourceId: item.id,
      routeSlug: item.id,
      title: item.title,
      displayLabel: item.title,
      type: 'classroom' as const,
      createdAt: item.created_at,
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