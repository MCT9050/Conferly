import MeetLiveSession from '@/components/meet/MeetLiveSession';
import EndMeetingButton from '@/components/meet/EndMeetingButton';
import { getServerSession } from '@/lib/auth';
import { verifyRoomAccessDetailed } from '@/lib/meetingAuth';
import { redirect, notFound } from 'next/navigation';

export default async function MeetRoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect('/auth');
  }

  const result = await verifyRoomAccessDetailed(session.userId, slug);

  // A confirmed missing meeting is a genuine 404.
  if (!result.found) {
    notFound();
  }

  // Access denial or an indeterminate backend lookup must not masquerade
  // as a missing meeting.
  if (!result.access) {
    redirect('/dashboard');
  }

  const access = result.access;

  // Phase 4: preserve owner-only meeting termination.
  const canEndMeeting = access.source === 'owner';

  return (
    <>
      {canEndMeeting && <EndMeetingButton meetingId={access.meetingId} />}

      <MeetLiveSession
        roomId={slug}
        meetingId={access.meetingId}
        userId={session.userId}
        role={access.accessRole}
        userName={session.email}
      />
    </>
  );
}
