import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { trackEvent } from '@/lib/monitoring';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';

function buildCookieOptions(request: Request, maxAge: number) {
  const host = request.headers.get('host') ?? '';
  const normalizedHost = host.replace(/:\d+$/, '');
  let domain: string | undefined;

  if (process.env.COOKIE_DOMAIN) {
    domain = process.env.COOKIE_DOMAIN.startsWith('.') ? process.env.COOKIE_DOMAIN : `.${process.env.COOKIE_DOMAIN}`;
  } else if (!normalizedHost.includes('localhost')) {
    const parts = normalizedHost.split('.');
    if (parts.length > 2 && parts[0] === 'www') {
      domain = `.${parts.slice(1).join('.')}`;
    } else if (parts.length > 2) {
      domain = `.${parts.slice(-2).join('.')}`;
    } else {
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

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase URL or anon key');
  }

  const baseUrl = url.replace(/\/+$/, '');
  return {
    apiKey: key,
    authTokenUrl: `${baseUrl}/auth/v1/token`,
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

    const body = await request.json();
    const { email, password, product } = body;

    if (!email || !password) {
      trackEvent({
        type: 'auth_failure',
        stage: 'signin',
        reason: 'missing_credentials',
        timestamp: Date.now(),
      });
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const { apiKey, authTokenUrl } = getSupabaseConfig();
    const tokenUrl = `${authTokenUrl}?grant_type=password`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        apikey: apiKey,
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

    // Use @supabase/ssr client to set cookies via the SDK,
    // which handles cookie chunking and naming conventions automatically.
    const response_ = new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const supabase = createSupabaseServerClient({ request, response: response_ });

    // Set the session via the SDK - this will set the proper HTTP cookies
    // with correct names (sb-* prefix) and handle chunking.
    await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    // Store default_product in user metadata if provided via ?product= query
    if (product && (product === 'meet' || product === 'class')) {
      await supabase.auth.updateUser({
        data: { default_product: product },
      });
    }

    return response_;
  } catch (error: unknown) {
    console.error('AUTH_SERVER_ERROR_LOG:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? (error as any).cause : undefined,
    });
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }
}