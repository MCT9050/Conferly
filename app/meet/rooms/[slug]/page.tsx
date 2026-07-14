import MeetLiveSession from '@/components/meet/MeetLiveSession';
import { getServerSession } from '@/lib/auth';
import { verifyAccess } from '@/lib/accessControl';
import { redirect } from 'next/navigation';
import { initTrace, trace, traceRedirect, traceError, formatTraceReport } from '@/lib/requestTrace';

// Generate unique request ID for this render
const requestId = `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`;

export default async function MeetRoomPage({ params }: { params: { slug: string } }) {
  // Initialize tracing for this request
  initTrace(requestId);
  
  try {
    trace('RENDER', 'meet-room-page', `Starting meet room page render for slug: ${params.slug}`);
    
    // Step 1: Get server session
    trace('AUTH', 'getServerSession-start', 'Calling getServerSession()');
    const session = await getServerSession();
    
    if (!session) {
      traceRedirect('/auth', 'No session found - user not authenticated');
      trace('RENDER', 'meet-room-page', 'No session - redirecting to /auth');
      console.log('\n' + formatTraceReport());
      redirect('/auth');
    }
    
    trace('AUTH', 'getServerSession-success', `Session found for user: ${session.userId}`, {
      hasUserId: !!session.userId,
      hasEmail: !!session.email,
      role: session.role,
    });
    
    // Step 2: Verify access
    trace('AUTH', 'verifyAccess-start', `Calling verifyAccess('meet', userId=${session.userId}, roomId=${params.slug})`);
    
    let access;
    try {
      access = await verifyAccess('meet', session.userId, params.slug);
    } catch (err) {
      traceError('verifyAccess', err as Error, { userId: session.userId, roomId: params.slug });
      console.log('\n' + formatTraceReport());
      throw err;
    }
    
    if (!access.granted) {
      trace('AUTH', 'verifyAccess-denied', 'Access denied - redirecting to /dashboard', {
        roomId: params.slug,
        reason: access.source || 'unknown',
      });
      traceRedirect('/dashboard', 'Access denied');
      console.log('\n' + formatTraceReport());
      redirect('/dashboard');
    }
    
    trace('AUTH', 'verifyAccess-granted', `Access granted with role: ${access.role}`, {
      roomId: access.roomId,
      source: access.source,
    });
    
    trace('RENDER', 'meet-room-page', 'Rendering MeetLiveSession component');
    console.log('\n' + formatTraceReport());
    
    return (
      <MeetLiveSession
        roomId={params.slug}
        userId={session.userId}
        role={access.role}
        userName={session.email}
      />
    );
  } catch (error) {
    if ((error as Error).message?.includes('NEXT_REDIRECT')) {
      // Re-throw redirects
      throw error;
    }
    traceError('meet-room-page', error as Error, { slug: params.slug });
    console.log('\n' + formatTraceReport());
    throw error;
  }
}