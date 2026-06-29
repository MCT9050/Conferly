import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { trackEvent } from '@/lib/monitoring';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase URL or anon key');
  }

  const baseUrl = url.replace(/\/+$/, '');
  return {
    apiKey: key,
    authSignupUrl: `${baseUrl}/auth/v1/signup`,
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

    const body = await request.json();
    const { email, password, displayName, product } = body;

    if (!email || !password || !displayName) {
      trackEvent({
        type: 'auth_failure',
        stage: 'signup',
        reason: 'missing_fields',
        timestamp: Date.now(),
      });
      return NextResponse.json({ error: 'Email, password, and display name are required.' }, { status: 400 });
    }

    const { apiKey, authSignupUrl } = getSupabaseConfig();
    const response = await fetch(authSignupUrl, {
      method: 'POST',
      headers: {
        apikey: apiKey,
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
      url: authSignupUrl,
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
      return NextResponse.json({
        error:
          data?.error_description || data?.error || data?.msg || 'Unable to sign up.',
      }, { status: statusToReturn });
    }

    trackEvent({ type: 'auth_success', stage: 'signup', timestamp: Date.now() });

    const needsConfirmation = Boolean(
      data?.confirmation_sent_at || data?.next_action?.type === 'email_verification'
    );

    if (data?.access_token) {
      const response_ = new NextResponse(
        JSON.stringify({ success: true, needsConfirmation }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const supabase = createSupabaseServerClient({ request, response: response_ });

      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      return response_;
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