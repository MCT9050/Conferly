import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { trackEvent } from '../../../../lib/monitoring';
import { getSupabaseApiKey, getSupabaseAuthTokenUrl, requireSupabaseConfig } from '../../../../lib/supabase';
import { rateLimitMiddleware, RATE_LIMITS } from '../../../../lib/rateLimit';

function buildCookieOptions(request: Request, maxAge: number) {
  const host = request.headers.get('host') ?? '';
  const normalizedHost = host.replace(/:\d+$/, '');
  let domain: string | undefined;

  if (process.env.COOKIE_DOMAIN) {
    domain = process.env.COOKIE_DOMAIN.startsWith('.') ? process.env.COOKIE_DOMAIN : `.${process.env.COOKIE_DOMAIN}`;
  } else if (!normalizedHost.includes('localhost')) {
    // For www.conferly.site, extract base domain (conferly.site) to allow all subdomains
    const parts = normalizedHost.split('.');
    if (parts.length > 2 && parts[0] === 'www') {
      // www.conferly.site -> .conferly.site
      domain = `.${parts.slice(1).join('.')}`;
    } else if (parts.length > 2) {
      // sub.conferly.site -> .conferly.site (assume last 2 parts are base domain)
      domain = `.${parts.slice(-2).join('.')}`;
    } else {
      // conferly.site or single-part host
      domain = `.${normalizedHost}`;
    }
  }

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
    // Rate limiting check
    const rateLimitResult = await rateLimitMiddleware(request, RATE_LIMITS.auth);
    if (!rateLimitResult.allowed) {
      trackEvent({
        type: 'auth_failure',
        stage: 'signin',
        reason: 'rate_limited',
        timestamp: Date.now(),
      });
      return NextResponse.json({ error: rateLimitResult.error }, { status: 429 });
    }

  requireSupabaseConfig();
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    trackEvent({
      type: 'auth_failure',
      stage: 'signin',
      reason: 'missing_credentials',
      timestamp: Date.now(),
    });
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const tokenUrl = `${getSupabaseAuthTokenUrl()}?grant_type=password`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      apikey: getSupabaseApiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const contentType = response.headers.get('content-type');
  const rawText = await response.text();
  const debugInfo = {
    stage: 'signin',
    url: tokenUrl,
    status: response.status,
    statusText: response.statusText,
    contentType,
    bodyPreview: rawText.slice(0, 2000),
  };

  if (!contentType?.includes('application/json')) {
    console.error('Supabase Upstream Failure (non-JSON):', debugInfo);
    trackEvent({
      type: 'auth_failure',
      stage: 'signin',
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
      stage: 'signin',
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
      stage: 'signin',
      reason: 'invalid_credentials',
      timestamp: Date.now(),
    });
    const statusToReturn = response.status >= 400 && response.status < 500 ? response.status : 502;
    return NextResponse.json({
      error: data?.error_description || data?.error || data?.msg || 'Invalid credentials.',
    }, { status: statusToReturn });
  }

  if (!data?.access_token) {
    trackEvent({
      type: 'auth_failure',
      stage: 'signin',
      reason: 'invalid_credentials',
      timestamp: Date.now(),
    });
    return NextResponse.json({ error: data?.error_description || data?.error || 'Invalid credentials.' }, { status: 401 });
  }

  trackEvent({ type: 'auth_success', stage: 'signin', timestamp: Date.now() });

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

