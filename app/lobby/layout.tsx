import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAuthorizedSession } from '@/lib/auth';
import { trackEvent } from '@/lib/monitoring';

export default async function LobbyLayout({ children }: { children: ReactNode }) {
  const session = await getAuthorizedSession({ requiredRoles: 'participant' });
  if (!session) {
    trackEvent({ type: 'custom', name: 'auth_failure', data: { route: '/lobby' }, timestamp: Date.now() });
    redirect('/auth');
  }

  return (
    <div>
      {children}
    </div>
  );
}
