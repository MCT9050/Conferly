import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

/**
 * GET /api/auth-test
 * 
 * Debug endpoint to verify the current session. Only available to
 * authenticated users. Returns basic session info if the caller
 * has a valid cookie-based session.
 */
export async function GET(request: Request) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    userId: session.userId,
    email: session.email ?? null,
    role: session.role,
    expires: session.expires,
  });
}

