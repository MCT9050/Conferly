import { getSupabaseServerClient } from './supabaseServerClient';

export type MeetingAccess = {
  meetingId: string;
  accessRole: 'participant' | 'spectator';
  source: 'owner' | 'participant' | 'public';
};

async function createPersonalRoom(ownerId: string, slug: string): Promise<{ id: string } | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('meetings')
    .insert({ owner: ownerId, slug, is_public: false, title: `Room ${slug}` })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[MeetingAuth] Auto-create meeting failed', {
      requestSlug: slug,
      ownerId,
      errorMessage: error?.message,
      errorCode: error?.code,
      dbError: error?.details,
    });
    return null;
  }
  console.log(`[MeetingAuth] Auto-created meeting ${data.id} for user ${ownerId} (slug: ${slug})`);
  return data;
}

export async function verifyRoomAccess(userId: string, roomId: string): Promise<MeetingAccess | null> {
  const supabase = getSupabaseServerClient();
  const normalizedRoomId = roomId.trim();

  const { data: meetingBySlug, error: meetingBySlugError } = await supabase
    .from('meetings')
    .select('id, owner, is_public')
    .eq('slug', normalizedRoomId)
    .maybeSingle();

  if (meetingBySlugError) {
    console.error('verifyRoomAccess: meeting lookup by slug failed', meetingBySlugError.message);
    return null;
  }

  const meeting = meetingBySlug ?? (await supabase
    .from('meetings')
    .select('id, owner, is_public')
    .eq('id', normalizedRoomId)
    .maybeSingle()).data;

  if (!meeting) {
    const created = await createPersonalRoom(userId, normalizedRoomId);
    if (created) {
      return { meetingId: created.id, accessRole: 'participant', source: 'owner' };
    }
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
    console.error('verifyRoomAccess: participant lookup failed', participantError.message);
    return null;
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
