import { createLogger } from './logger';
import { buildMeetingInsert } from './meetingPersistence';
import { getSupabaseServerClient } from './supabaseServerClient';

export type MeetingAccess = {
  meetingId: string;
  accessRole: 'owner' | 'participant' | 'spectator';
  source: 'owner' | 'participant' | 'public';
};

const meetingLogger = createLogger('meetingAuth');

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type MeetingWriterClient = ReturnType<typeof getSupabaseServerClient>;

function classifyMeetingWriteError(code?: string): string {
  switch (code) {
    case '23502':
      return 'Required field missing';
    case '23503':
      return 'Invalid foreign-key reference';
    case '23505':
      return 'Duplicate slug or unique value';
    case '42501':
      return 'RLS/permission denial';
    case '22P02':
      return 'Invalid UUID';
    case 'PGRST204':
      return 'Schema contract/cache mismatch';
    default:
      return 'Unclassified database error';
  }
}

function logMeetingWriteFailure(
  operation: string,
  userId: string,
  payloadFieldNames: string[],
  error: SupabaseErrorLike | null | undefined,
) {
  meetingLogger.error('Meeting write failed', undefined, {
    context: {
      operation,
      route: 'lib/meetingAuth#createPersonalRoom',
      code: error?.code ?? null,
      classification: classifyMeetingWriteError(error?.code),
      message: error?.message ?? 'Unknown database error',
      authenticatedUserPresent: Boolean(userId),
      payloadFieldNames,
    },
    userId,
  });
}

export async function createPersonalRoom(
  ownerId: string,
  slug: string,
  supabase: MeetingWriterClient = getSupabaseServerClient(),
): Promise<{ id: string } | null> {
  const insertPayload = buildMeetingInsert({
    ownerId,
    slug,
    title: `Room ${slug}`,
    isPublic: false,
  });
  console.log('TRACE: insert payload', insertPayload);

  const { data, error } = await supabase
    .from('meetings')
    .insert(insertPayload)
    .select('id')
    .single();
  console.log('TRACE: insert result', data, error);

  if (error || !data) {
    logMeetingWriteFailure(
      'meetings.insert.auto_create_personal_room',
      ownerId,
      Object.keys(insertPayload),
      error,
    );

    if (error?.code === '23505') {
      const { data: existingMeeting, error: lookupError } = await supabase
        .from('meetings')
        .select('id')
        .eq('slug', insertPayload.slug)
        .maybeSingle();

      if (lookupError) {
        meetingLogger.error('Meeting lookup after duplicate insert failed', undefined, {
          context: {
            operation: 'meetings.select.lookup_after_duplicate_slug',
            route: 'lib/meetingAuth#createPersonalRoom',
            code: lookupError.code ?? null,
            classification: classifyMeetingWriteError(lookupError.code),
            message: lookupError.message,
            authenticatedUserPresent: Boolean(ownerId),
            payloadFieldNames: ['slug'],
          },
          userId: ownerId,
        });
        return null;
      }

      if (existingMeeting) {
        return existingMeeting;
      }
    }

    return null;
  }

  meetingLogger.info('Auto-created meeting for verified room access', {
    context: {
      operation: 'meetings.insert.auto_create_personal_room',
      route: 'lib/meetingAuth#createPersonalRoom',
      payloadFieldNames: Object.keys(insertPayload),
    },
    userId: ownerId,
    meetingId: data.id,
  });

  return data;
}

export async function verifyRoomAccess(userId: string, roomId: string): Promise<MeetingAccess | null> {
  console.log('TRACE: entering verifyRoomAccess', { userId, roomId });
  const supabase = getSupabaseServerClient();
  const normalizedRoomId = roomId.trim();

  const { data: meetingBySlug, error: meetingBySlugError } = await supabase
    .from('meetings')
    .select('id, owner, is_public')
    .eq('slug', normalizedRoomId)
    .maybeSingle();
  console.log('TRACE: meeting lookup result', meetingBySlug, meetingBySlugError);

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
