import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAuthorizedSession } from '@/lib/auth';
import { trackEvent } from '@/lib/monitoring';

export default async function MeetingLayout({ children }: { children: ReactNode }) {
  const session = await getAuthorizedSession({ requiredRoles: 'participant' });
  if (!session) {
    trackEvent({ type: 'custom', name: 'auth_failure', data: { route: '/meeting' }, timestamp: Date.now() });
    redirect('/auth');
  }

  return (
    <div>
      {children}
    </div>
  );
}
