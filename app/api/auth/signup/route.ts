import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { trackEvent } from '../../../../lib/monitoring';
import { getSupabaseApiKey, getSupabaseAuthSignupUrl, requireSupabaseConfig } from '../../../../lib/supabase';
import { rateLimitMiddleware, RATE_LIMITS } from '../../../../lib/rateLimit';

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
    // Rate limiting check (stricter for signup)
    const rateLimitResult = await rateLimitMiddleware(request, RATE_LIMITS.signup);
    if (!rateLimitResult.allowed) {
      trackEvent({
        type: 'auth_failure',
        stage: 'signup',
        reason: 'rate_limited',
        timestamp: Date.now(),
      });
      return NextResponse.json({ error: rateLimitResult.error }, { status: 429 });
    }

    requireSupabaseConfig();
    const body = await request.json();
    const { email, password, displayName } = body;

  if (!email || !password || !displayName) {
    trackEvent({
      type: 'auth_failure',
      stage: 'signup',
      reason: 'missing_fields',
      timestamp: Date.now(),
    });
    return NextResponse.json({ error: 'Email, password, and display name are required.' }, { status: 400 });
  }

  const signupUrl = getSupabaseAuthSignupUrl();
  const response = await fetch(signupUrl, {
    method: 'POST',
    headers: {
      apikey: getSupabaseApiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      options: {
        data: { full_name: displayName, role: 'participant' },
      },
    }),
  });

  const contentType = response.headers.get('content-type');
  const rawText = await response.text();
  const debugInfo = {
    stage: 'signup',
    url: signupUrl,
    status: response.status,
    statusText: response.statusText,
    contentType,
    bodyPreview: rawText.slice(0, 2000),
  };

  if (!contentType?.includes('application/json')) {
    console.error('Supabase Upstream Failure (non-JSON):', debugInfo);
    trackEvent({
      type: 'auth_failure',
      stage: 'signup',
      reason: 'upstream_error',
      timestamp: Date.now(),
    });
    return NextResponse.json(
      { error: 'Authentication gateway timeout. Please try again shortly.' },
      { status: 502 }
    );
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (parseError) {
    console.error('Supabase Upstream Failure:', {
      ...debugInfo,
      parseError: parseError instanceof Error ? parseError.message : String(parseError),
    });
    trackEvent({
      type: 'auth_failure',
      stage: 'signup',
      reason: 'upstream_error',
      timestamp: Date.now(),
    });
    return NextResponse.json(
      { error: 'Authentication gateway timeout. Please try again shortly.' },
      { status: 502 }
    );
  }
  if (!response.ok) {
    console.error('Supabase Upstream Failure:', { ...debugInfo, parsed: data });
    trackEvent({
      type: 'auth_failure',
      stage: 'signup',
      reason: 'signup_failed',
      timestamp: Date.now(),
    });
    const statusToReturn = response.status >= 400 && response.status < 500 ? response.status : 502;
    return NextResponse.json({ error: data?.error_description || data?.error || 'Unable to sign up.' }, { status: statusToReturn });
  }

  trackEvent({ type: 'auth_success', stage: 'signup', timestamp: Date.now() });

  const needsConfirmation = Boolean(data?.confirmation_sent_at || data?.next_action?.type === 'email_verification');

  // If Supabase returned tokens, set cookies similarly to signin flow.
  if (data?.access_token) {
    const cookieStore = await cookies();
    const cookieOptions = buildCookieOptions(request, data.expires_in ?? 60 * 60);

    const authTokenValue = JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });

    cookieStore.set('sb-access-token', data.access_token, cookieOptions);
    cookieStore.set('supabase-auth-token', authTokenValue, cookieOptions);

    return NextResponse.json({ success: true, needsConfirmation }, { status: 200 });
  }

  return NextResponse.json({ success: true, needsConfirmation }, { status: 200 });
  } catch (error: unknown) {
    console.error('AUTH_SERVER_ERROR_LOG:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? (error as any).cause : undefined,
    });
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }
}

