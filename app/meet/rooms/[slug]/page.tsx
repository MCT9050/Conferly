import MeetLiveSession from '@/components/meet/MeetLiveSession';
import EndMeetingButton from '@/components/meet/EndMeetingButton';
import { getServerSession } from '@/lib/auth';
import { verifyAccess } from '@/lib/accessControl';
import { redirect } from 'next/navigation';

export default async function MeetRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getServerSession();
  if (!session) redirect('/auth');

  const access = await verifyAccess('meet', session.userId, slug);
  if (!access.granted) redirect('/dashboard');

  // P4-2b: only the meeting owner gets the host end-action fallback.
  const canEndMeeting = access.source === 'owner';

  return (
    <>
      {canEndMeeting && <EndMeetingButton meetingId={access.roomId} />}
      <MeetLiveSession
        roomId={slug}
        meetingId={access.roomId}
        userId={session.userId}
        role={access.role}
        userName={session.email}
      />
    </>
  );
}
