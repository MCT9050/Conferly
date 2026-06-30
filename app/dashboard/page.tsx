import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProductSelector } from '@/components/platform/ProductSelector';

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const { data: recentMeetings } = await supabase
    .from('meetings')
    .select('id, title, created_at')
    .eq('owner', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  const { data: recentClassrooms } = await supabase
    .from('classrooms')
    .select('id, title, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);

  const recentActivity = [
    ...(recentMeetings || []).map((m) => ({ ...m, type: 'meeting' as const })),
    ...(recentClassrooms || []).map((c) => ({ ...c, type: 'classroom' as const })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="container mx-auto py-8">
      <ProductSelector user={user} recentActivity={recentActivity} />
    </div>
  );
}