import { getSupabaseServerClient } from './supabaseServerClient';

export type MeetingAccess = {
  meetingId: string;
  accessRole: 'participant' | 'spectator';
  source: 'owner' | 'participant' | 'public';
};

export async function verifyRoomAccess(userId: string, roomId: string): Promise<MeetingAccess | null> {
  const supabase = getSupabaseServerClient();
  const normalizedRoomId = roomId.trim();

  const { data: meetingBySlug, error: meetingBySlugError } = await supabase
    .from('meetings')
    .select('id, owner, is_public')
    .eq('slug', normalizedRoomId)
    .maybeSingle();

  if (meetingBySlugError) {
    throw new Error(meetingBySlugError.message);
  }

  const meeting = meetingBySlug ?? (await supabase
    .from('meetings')
    .select('id, owner, is_public')
    .eq('id', normalizedRoomId)
    .maybeSingle()).data;

  if (!meeting) {
    return null;
  }

  if (meeting.owner === userId) {
    return { meetingId: meeting.id, accessRole: 'participant', source: 'owner' };
  }

  const { data: participant, error: participantError } = await supabase
    .from('meeting_participants')
    .select('role')
    .eq('meeting_id', meeting.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (participantError) {
    throw new Error(participantError.message);
  }

  if (participant?.role) {
    const accessRole = participant.role === 'spectator' ? 'spectator' : 'participant';
    return { meetingId: meeting.id, accessRole, source: 'participant' };
  }

  if (meeting.is_public) {
    return { meetingId: meeting.id, accessRole: 'spectator', source: 'public' };
  }

  return null;
}
