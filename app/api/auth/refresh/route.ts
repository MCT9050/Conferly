import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { trackEvent } from '../../../../lib/monitoring';
import { getSupabaseApiKey, getSupabaseAuthTokenUrl, requireSupabaseConfig } from '../../../../lib/supabase';

function buildCookieOptions(request: Request, maxAge: number) {
  const host = request.headers.get('host') ?? '';
  const normalizedHost = host.replace(/:\d+$/, '');
  const envDomain = process.env.COOKIE_DOMAIN ?? normalizedHost;
  const domain = envDomain && !envDomain.includes('localhost')
    ? envDomain.startsWith('.') ? envDomain : `.${envDomain}`
    : undefined;

  return {
    httpOnly: true,
    path: '/',
    domain,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
  };
}

export async function POST(request: Request) {
  try {
    requireSupabaseConfig();
    const cookieHeader = request.headers.get('cookie') || '';
    // Parse supabase-auth-token cookie
    const match = cookieHeader.split(';').map(p => p.trim()).find(p => p.startsWith('supabase-auth-token='));
    if (!match) {
      trackEvent({ type: 'auth_failure', stage: 'refresh', reason: 'no_refresh_token_cookie', timestamp: Date.now() });
      return NextResponse.json({ error: 'No refresh token available' }, { status: 401 });
    }
    const raw = decodeURIComponent(match.split('=')[1] || '');
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    const refreshToken = parsed?.refresh_token;
    if (!refreshToken) {
      trackEvent({ type: 'auth_failure', stage: 'refresh', reason: 'no_refresh_token', timestamp: Date.now() });
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    }

    const refreshUrl = `${getSupabaseAuthTokenUrl()}?grant_type=refresh_token`;
    const resp = await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        apikey: getSupabaseApiKey(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const contentType = resp.headers.get('content-type');
    const rawText = await resp.text();
    const debugInfo = {
      stage: 'refresh',
      url: refreshUrl,
      status: resp.status,
      statusText: resp.statusText,
      contentType,
      bodyPreview: rawText.slice(0, 2000),
    };
    if (!resp.ok || !contentType?.includes('application/json')) {
      console.error('Supabase Upstream Failure:', debugInfo);
      trackEvent({ type: 'auth_failure', stage: 'refresh', reason: 'refresh_api_error', timestamp: Date.now() });
      return NextResponse.json({ error: 'Authentication gateway timeout. Please try again shortly.' }, { status: 502 });
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Supabase Upstream Failure:', {
        ...debugInfo,
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
      });
      trackEvent({ type: 'auth_failure', stage: 'refresh', reason: 'refresh_api_error', timestamp: Date.now() });
      return NextResponse.json({ error: 'Authentication gateway timeout. Please try again shortly.' }, { status: 502 });
    }
    if (!resp.ok || !data?.access_token) {
      trackEvent({ type: 'auth_failure', stage: 'refresh', reason: 'refresh_api_error', timestamp: Date.now() });
      return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
    }

    trackEvent({ type: 'auth_success', stage: 'refresh', timestamp: Date.now() });

    const cookieStore = await cookies();
    const cookieOptions = buildCookieOptions(request, data.expires_in ?? 60 * 60);
    const authTokenValue = JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });

    cookieStore.set('sb-access-token', data.access_token, cookieOptions);
    cookieStore.set('supabase-auth-token', authTokenValue, cookieOptions);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error('AUTH_SERVER_ERROR_LOG:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? (error as any).cause : undefined,
    });
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }
}

