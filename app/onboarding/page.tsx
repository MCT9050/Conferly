import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import OnboardingWizard from '@/components/platform/OnboardingWizard';

export default async function OnboardingPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Unauthenticated users → auth
  if (!user?.id) {
    redirect('/auth');
  }

  // Already completed → dashboard
  const { data: profile } = await supabase
    .from('profiles')
    .select('meet_intent, class_intent, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <OnboardingWizard
        initialMeetIntent={(profile?.meet_intent as 'host' | 'attend' | null) ?? null}
        initialClassIntent={(profile?.class_intent as 'teacher' | 'student' | null) ?? null}
      />
    </main>
  );
}
