import MeetLiveSession from '@/components/meet/MeetLiveSession';
import { getServerSession } from '@/lib/auth';
import { verifyAccess } from '@/lib/accessControl';
import { redirect } from 'next/navigation';

export default async function MeetRoomPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession();
  if (!session) redirect('/auth');

  const access = await verifyAccess('meet', session.userId, params.slug);
  if (!access.granted) redirect('/dashboard');

  return (
    <MeetLiveSession
      roomId={params.slug}
      userId={session.userId}
      role={access.role}
      userName={session.email}
    />
  );
}