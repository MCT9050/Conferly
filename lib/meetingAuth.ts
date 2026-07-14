import { getSupabaseServerClient } from './supabaseServerClient';

export type MeetingAccess = {
  meetingId: string;
  accessRole: 'participant' | 'spectator';
  source: 'owner' | 'participant' | 'public';
};

// Request tracing for debugging
const TRACE_ENABLED = process.env.NODE_ENV === 'development' || process.env.AUTH_TRACE === 'true';

function traceAccess(step: string, detail: string, data?: Record<string, unknown>): void {
  if (TRACE_ENABLED) {
    console.log(`[ACCESS_TRACE] [${new Date().toISOString()}] ${step}: ${detail}`, data ? JSON.stringify(data) : '');
  }
}

async function createPersonalRoom(ownerId: string, slug: string): Promise<{ id: string } | null> {
  traceAccess('createPersonalRoom-start', `Creating personal room for user ${ownerId}, slug: ${slug}`);
  
  const supabase = getSupabaseServerClient();
  const id = slug;
  const { data, error } = await supabase
    .from('meetings')
    .insert({ id, owner: ownerId, slug, is_public: false, title: `Room ${slug}` })
    .select('id')
    .single();

  if (error || !data) {
    console.error('verifyRoomAccess: auto-create meeting failed', error?.message);
    traceAccess('createPersonalRoom-error', `Failed to create meeting: ${error?.message}`);
    return null;
  }
  console.log(`[verifyRoomAccess] Auto-created meeting ${id} for user ${ownerId}`);
  traceAccess('createPersonalRoom-success', `Created meeting ${id} for user ${ownerId}`);
  return data;
}

export async function verifyRoomAccess(userId: string, roomId: string): Promise<MeetingAccess | null> {
  traceAccess('verifyRoomAccess-start', `userId=${userId}, roomId=${roomId}`);
  
  let supabase;
  try {
    supabase = getSupabaseServerClient();
    traceAccess('getSupabaseServerClient-success', 'Service role client created');
  } catch (err) {
    traceAccess('getSupabaseServerClient-error', `Failed to create Supabase client: ${err instanceof Error ? err.message : String(err)}`, {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }
  
  const normalizedRoomId = roomId.trim();
  traceAccess('normalize-roomId', `Normalized roomId: ${normalizedRoomId}`);

  // Step 1: Lookup by slug
  traceAccess('query-meetings-by-slug-start', `Looking up meeting by slug: ${normalizedRoomId}`);
  const { data: meetingBySlug, error: meetingBySlugError } = await supabase
    .from('meetings')
    .select('id, owner, is_public')
    .eq('slug', normalizedRoomId)
    .maybeSingle();

  if (meetingBySlugError) {
    console.error('verifyRoomAccess: meeting lookup by slug failed', meetingBySlugError.message);
    traceAccess('query-meetings-by-slug-error', `Query failed: ${meetingBySlugError.message}`, {
      code: meetingBySlugError.code,
      details: meetingBySlugError.details,
    });
    return null;
  }
  
  traceAccess('query-meetings-by-slug-result', `Found ${meetingBySlug ? 1 : 0} meetings by slug`, {
    meeting: meetingBySlug,
  });

  // Step 2: If not found by slug, try by ID
  let meeting = meetingBySlug;
  if (!meeting) {
    traceAccess('query-meetings-by-id-start', `Looking up meeting by ID: ${normalizedRoomId}`);
    const { data: meetingById, error: meetingByIdError } = await supabase
      .from('meetings')
      .select('id, owner, is_public')
      .eq('id', normalizedRoomId)
      .maybeSingle();
      
    if (meetingByIdError) {
      console.error('verifyRoomAccess: meeting lookup by ID failed', meetingByIdError.message);
      traceAccess('query-meetings-by-id-error', `Query failed: ${meetingByIdError.message}`);
      return null;
    }
    
    meeting = meetingById;
    traceAccess('query-meetings-by-id-result', `Found ${meetingById ? 1 : 0} meetings by ID`);
  }

  // Step 3: If still not found, auto-create personal room
  if (!meeting) {
    traceAccess('no-meeting-found', 'Meeting not found, attempting auto-creation');
    const created = await createPersonalRoom(userId, normalizedRoomId);
    if (created) {
      traceAccess('auto-create-success', `Auto-created room, returning as owner`, { meetingId: created.id });
      return { meetingId: created.id, accessRole: 'participant', source: 'owner' };
    }
    traceAccess('auto-create-failed', 'Failed to auto-create room');
    return null;
  }

  traceAccess('meeting-found', `Found meeting ${meeting.id}`, {
    owner: meeting.owner,
    isPublic: meeting.is_public,
  });

  // Step 4: Check if user is owner
  if (meeting.owner === userId) {
    traceAccess('owner-check-pass', `User ${userId} is owner of meeting ${meeting.id}`);
    return { meetingId: meeting.id, accessRole: 'participant', source: 'owner' };
  }
  traceAccess('owner-check-fail', `User ${userId} is NOT owner (owner is ${meeting.owner})`);

  // Step 5: Check if user is participant
  traceAccess('query-participants-start', `Looking up participant for meeting ${meeting.id}, user ${userId}`);
  const { data: participant, error: participantError } = await supabase
    .from('meeting_participants')
    .select('role')
    .eq('meeting_id', meeting.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (participantError) {
    console.error('verifyRoomAccess: participant lookup failed', participantError.message);
    traceAccess('query-participants-error', `Query failed: ${participantError.message}`);
    return null;
  }
  
  traceAccess('query-participants-result', `Found ${participant ? 1 : 0} participant records`, {
    participant,
  });

  if (participant?.role) {
    const accessRole = participant.role === 'spectator' ? 'spectator' : 'participant';
    traceAccess('participant-access-granted', `User is participant with role: ${accessRole}`);
    return { meetingId: meeting.id, accessRole, source: 'participant' };
  }

  // Step 6: Check if meeting is public
  if (meeting.is_public) {
    traceAccess('public-meeting-access', `Meeting is public, granting spectator access`);
    return { meetingId: meeting.id, accessRole: 'spectator', source: 'public' };
  }

  traceAccess('access-denied', 'No access path found - denying access');
  return null;
}
