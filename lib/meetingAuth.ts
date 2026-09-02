import { createLogger } from './logger';
import { getSupabaseServerClient } from './supabaseServerClient';

export type MeetingAccess = {
  meetingId: string;
  accessRole: 'owner' | 'presenter' | 'participant' | 'spectator';
  source: 'owner' | 'participant' | 'public';
};

export type MeetingAccessResult =
  | { found: true; access: MeetingAccess }
  | { found: true; access: null }
  | { found: false; access: null };

const meetingLogger = createLogger('meetingAuth');

export async function verifyRoomAccess(userId: string, roomId: string): Promise<MeetingAccess | null> {
  const supabase = getSupabaseServerClient();
  const normalizedRoomId = roomId.trim();

  const { data: meetingBySlug, error: meetingBySlugError } = await supabase
    .from('meetings')
    .select('id, owner, is_public')
    .eq('slug', normalizedRoomId)
    .maybeSingle();

  if (meetingBySlugError) {
    meetingLogger.error('Meeting lookup by slug failed', undefined, {
      context: { route: 'lib/meetingAuth#verifyRoomAccess', code: meetingBySlugError.code ?? null },
    });
    return null;
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
    return { meetingId: meeting.id, accessRole: 'owner', source: 'owner' };
  }

  const { data: participant, error: participantError } = await supabase
    .from('meeting_participants')
    .select('role')
    .eq('meeting_id', meeting.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (participantError) {
    meetingLogger.error('Meeting participant lookup failed', undefined, {
      context: { route: 'lib/meetingAuth#verifyRoomAccess', code: participantError.code ?? null },
    });
    return null;
  }

  if (participant?.role) {
    const accessRole = participant.role === 'presenter'
      ? 'presenter'
      : participant.role === 'spectator'
        ? 'spectator'
        : 'participant';
    return { meetingId: meeting.id, accessRole, source: 'participant' };
  }

  if (meeting.is_public) {
    return { meetingId: meeting.id, accessRole: 'spectator', source: 'public' };
  }

  return null;
}

/**
 * Detailed room-access verification for callers that need to distinguish a
 * genuinely missing meeting from an authorization or backend failure.
 */
export async function verifyRoomAccessDetailed(
  userId: string,
  roomId: string
): Promise<MeetingAccessResult> {
  const supabase = getSupabaseServerClient();
  const normalizedRoomId = roomId.trim();

  const { data: meetingBySlug, error: meetingBySlugError } = await supabase
    .from('meetings')
    .select('id, owner, is_public')
    .eq('slug', normalizedRoomId)
    .maybeSingle();

  if (meetingBySlugError) {
    meetingLogger.error('Meeting lookup by slug failed (detailed)', undefined, {
      context: {
        route: 'lib/meetingAuth#verifyRoomAccessDetailed',
        code: meetingBySlugError.code ?? null,
      },
    });
    return { found: true, access: null };
  }

  let meeting = meetingBySlug;

  if (!meeting) {
    const { data: meetingById, error: meetingByIdError } = await supabase
      .from('meetings')
      .select('id, owner, is_public')
      .eq('id', normalizedRoomId)
      .maybeSingle();

    if (meetingByIdError) {
      meetingLogger.error('Meeting lookup by id failed (detailed)', undefined, {
        context: {
          route: 'lib/meetingAuth#verifyRoomAccessDetailed',
          code: meetingByIdError.code ?? null,
        },
      });
      return { found: true, access: null };
    }

    meeting = meetingById;
  }

  if (!meeting) {
    return { found: false, access: null };
  }

  if (meeting.owner === userId) {
    return {
      found: true,
      access: {
        meetingId: meeting.id,
        accessRole: 'owner',
        source: 'owner',
      },
    };
  }

  const { data: participant, error: participantError } = await supabase
    .from('meeting_participants')
    .select('role')
    .eq('meeting_id', meeting.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (participantError) {
    meetingLogger.error('Meeting participant lookup failed (detailed)', undefined, {
      context: {
        route: 'lib/meetingAuth#verifyRoomAccessDetailed',
        code: participantError.code ?? null,
      },
    });
    return { found: true, access: null };
  }

  if (participant?.role) {
    const accessRole =
      participant.role === 'presenter'
        ? 'presenter'
        : participant.role === 'spectator'
          ? 'spectator'
          : 'participant';

    return {
      found: true,
      access: {
        meetingId: meeting.id,
        accessRole,
        source: 'participant',
      },
    };
  }

  if (meeting.is_public) {
    return {
      found: true,
      access: {
        meetingId: meeting.id,
        accessRole: 'spectator',
        source: 'public',
      },
    };
  }

  return { found: true, access: null };
}
