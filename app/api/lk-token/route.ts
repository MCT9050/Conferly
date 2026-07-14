import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createLiveKitToken, LiveKitRole } from '@/lib/livekit';
import { verifyAccess } from '@/lib/accessControl';

const VALID_ROLES = new Set<LiveKitRole>(['participant', 'spectator']);

// Request tracing
const requestId = `lk-${Date.now()}-${Math.random().toString(36).substring(7)}`;

function trace(step: string, detail: string, data?: Record<string, unknown>): void {
  console.log(`[LK_TOKEN_TRACE:${requestId}] [${new Date().toISOString()}] ${step}: ${detail}`, data ? JSON.stringify(data) : '');
}

/**
 * Retrieve LiveKit URL directly from process.env.
 * Bypasses getServerEnv() cache to avoid 'Env Desync' issues.
 */
function getLiveKitUrl(): string {
  const url = process.env.LIVEKIT_URL?.trim();
  if (!url) {
    trace('LIVEKIT_URL-missing', 'LIVEKIT_URL environment variable is not set');
    throw new Error('LIVEKIT_URL is not configured. Check .env.local or Vercel env vars.');
  }
  trace('LIVEKIT_URL-present', `LIVEKIT_URL configured: ${url}`);
  return url;
}

export async function POST(request: Request) {
  trace('POST-start', `Received POST request to /api/lk-token`);
  
  // ── Auth Guard ───────────────────────────────────────────────────────────
  trace('AUTH-start', 'Starting authentication check');
  let session;
  try {
    session = await getServerSession(request);
    trace('AUTH-completed', 'getServerSession() returned', { hasSession: !!session, hasUserId: !!session?.userId });
  } catch (err) {
    trace('AUTH-error', `getServerSession() threw error: ${err instanceof Error ? err.message : String(err)}`, {
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Please log in to join the meeting' },
      { status: 401 }
    );
  }

  if (!session) {
    trace('AUTH-failed', 'No session found - returning 401');
    return NextResponse.json(
      { error: 'Please log in to join the meeting' },
      { status: 401 }
    );
  }

  if (!session.userId) {
    trace('AUTH-invalid', 'Session missing userId - returning 401');
    return NextResponse.json(
      { error: 'Invalid session: missing userId' },
      { status: 401 }
    );
  }
  
  trace('AUTH-success', `Authenticated user: ${session.userId}`, { role: session.role });

  // ── Data Validation ──────────────────────────────────────────────────────
  trace('VALIDATION-start', 'Parsing request body');
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
    trace('VALIDATION-parsed', 'Request body parsed successfully', { payload });
  } catch {
    trace('VALIDATION-error', 'Failed to parse request body');
    return NextResponse.json(
      { error: 'Meeting ID required' },
      { status: 400 }
    );
  }

  const roomId = String(payload?.roomId ?? payload?.room ?? '').trim();
  const requestedRole = String(payload?.role ?? 'participant').trim() as LiveKitRole;
  const username = String(payload?.username ?? payload?.name ?? '').trim();
  const domain = String(payload?.domain ?? 'meet').trim();

  trace('VALIDATION-fields', 'Extracted fields from request', { roomId, requestedRole, username, domain });

  if (!roomId) {
    trace('VALIDATION-missing-roomId', 'roomId is empty - returning 400');
    return NextResponse.json(
      { error: 'Meeting ID required' },
      { status: 400 }
    );
  }

  if (!VALID_ROLES.has(requestedRole)) {
    trace('VALIDATION-invalid-role', `Invalid role: ${requestedRole}`);
    return NextResponse.json(
      { error: 'Invalid role' },
      { status: 400 }
    );
  }

  if (domain !== 'meet' && domain !== 'class') {
    trace('VALIDATION-invalid-domain', `Invalid domain: ${domain}`);
    return NextResponse.json(
      { error: 'Invalid domain' },
      { status: 400 }
    );
  }

  // ── Room Access Verification ─────────────────────────────────────────────
  trace('ACCESS-start', `Calling verifyAccess(domain=${domain}, userId=${session.userId}, roomId=${roomId})`);
  let access;
  try {
    access = await verifyAccess(domain, session.userId, roomId);
    trace('ACCESS-completed', 'verifyAccess() returned', { granted: access.granted, role: access.role, roomId: access.roomId });
  } catch (err) {
    trace('ACCESS-error', `verifyAccess() threw: ${err instanceof Error ? err.message : String(err)}`, {
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  if (!access.granted) {
    trace('ACCESS-denied', 'Access denied by verifyAccess()', { domain, roomId, source: access.source });
    return NextResponse.json(
      { error: 'Access denied to this room' },
      { status: 403 }
    );
  }
  
  trace('ACCESS-granted', 'Access granted', { role: access.role, roomId: access.roomId });

  // ── LiveKit URL ──────────────────────────────────────────────────────────
  let liveKitUrl: string;
  try {
    liveKitUrl = getLiveKitUrl();
  } catch (err) {
    trace('LIVEKIT_URL-error', `getLiveKitUrl() failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'LIVEKIT_URL not configured' },
      { status: 500 }
    );
  }

  // For class domain, resolve the classroom slug to the actual LiveKit room
  let effectiveRoomId = access.roomId;
  if (domain === 'class') {
    trace('CLASS-resolve-room', `Resolving LiveKit room for classroom ${access.roomId}`);
    const classroomId = access.roomId;
    const { createClient } = await import('@supabase/supabase-js');
    const { getServerEnv } = await import('@/lib/serverEnv');
    const env = getServerEnv();
    const serviceRoleKey =
      env.SUPABASE_SERVICE_ROLE_KEY ??
      (() => { throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in lk-token route'); })();
    const supabase = createClient(env.SUPABASE_URL, serviceRoleKey);
    const { data: activeLesson } = await supabase
      .from('classroom_lessons')
      .select('livekit_room_id')
      .eq('classroom_id', classroomId)
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .maybeSingle();
    effectiveRoomId = activeLesson?.livekit_room_id ?? classroomId;
    trace('CLASS-resolved', `Resolved to LiveKit room: ${effectiveRoomId}`, { hasLivekitRoomId: !!activeLesson?.livekit_room_id });
  }

  const role = access.role === 'spectator' ? 'spectator' : requestedRole;
  const displayName = username || session.email || `Participant-${session.userId.slice(0, 4)}`;

  trace('TOKEN-generate-start', 'Calling createLiveKitToken()', {
    identity: session.userId,
    name: displayName,
    room: effectiveRoomId,
    role,
  });

  // ── LiveKit Token Generation (isolated try/catch) ────────────────────────
  let token: string;
  try {
    token = await createLiveKitToken({
      identity: session.userId,
      name: displayName,
      room: effectiveRoomId,
      role,
    });
    trace('TOKEN-generated', `Token generated successfully (${token.length} chars)`);
  } catch (err) {
    console.error('[LK_SERVER_ERROR] LiveKit token generation failed:', err);
    console.error('[LK_SERVER_ERROR] Input:', { identity: session.userId, name: displayName, room: roomId, role });
    trace('TOKEN-error', `createLiveKitToken() failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }

  trace('POST-success', 'Returning token to client', { tokenLength: token.length, url: liveKitUrl });
  return NextResponse.json({ token, url: liveKitUrl });
}
