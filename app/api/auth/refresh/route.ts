import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { trackEvent } from '@/lib/monitoring';

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
    const { apiKey, authTokenUrl } = getSupabaseConfig();
    const cookieHeader = request.headers.get('cookie') || '';

    // @supabase/ssr handles cookie names and chunking internally.
    // We still need the raw cookie to send the refresh_token to Supabase's
    // auth endpoint since this is a server-to-server call.
    const sbCookies = cookieHeader.split(';').reduce<Record<string, string>>((map, part) => {
      const [name, ...rest] = part.trim().split('=');
      if (name) map[name] = rest.join('=');
      return map;
    }, {});

    // Try to find the refresh token from the standard sb- prefix cookies
    // that @supabase/ssr sets. The SDK stores the full session in
    // sb-<project-ref>-auth-token cookie.
    let refreshToken: string | null = null;
    for (const [name, value] of Object.entries(sbCookies)) {
      if (name.includes('auth-token') && !name.endsWith('.0') && !name.endsWith('.1')) {
        try {
          const decoded = decodeURIComponent(value);
          const parsed = JSON.parse(decoded);
          if (parsed?.refresh_token) {
            refreshToken = parsed.refresh_token;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (!refreshToken) {
      trackEvent({
        type: 'auth_failure',
        stage: 'refresh',
        reason: 'no_refresh_token_cookie',
        timestamp: Date.now(),
      });
      return NextResponse.json({ error: 'No refresh token available' }, { status: 401 });
    }

    const refreshUrl = `${authTokenUrl}?grant_type=refresh_token`;
    const resp = await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        apikey: apiKey,
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
      trackEvent({
        type: 'auth_failure',
        stage: 'refresh',
        reason: 'refresh_api_error',
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
        stage: 'refresh',
        reason: 'refresh_api_error',
        timestamp: Date.now(),
      });
      return NextResponse.json(
        { error: 'Authentication gateway timeout. Please try again shortly.' },
        { status: 502 }
      );
    }

    if (!resp.ok || !data?.access_token) {
      trackEvent({
        type: 'auth_failure',
        stage: 'refresh',
        reason: 'refresh_api_error',
        timestamp: Date.now(),
      });
      return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
    }

    trackEvent({ type: 'auth_success', stage: 'refresh', timestamp: Date.now() });

    // Use @supabase/ssr client to set the refreshed session cookies
    // with proper naming conventions (sb-* prefix) and chunking.
    const response = new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const supabase = createSupabaseServerClient({ request, response });

    await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    return response;
  } catch (error: unknown) {
    console.error('AUTH_SERVER_ERROR_LOG:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? (error as any).cause : undefined,
    });
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }
}