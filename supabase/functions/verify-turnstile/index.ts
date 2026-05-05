// Cloudflare Turnstile Verification Edge Function
// Validates Turnstile tokens before allowing Supabase auth

declare const Deno: {
  serve(fn: (req: Request) => Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};

Deno.serve(async (req: Request): Promise<Response> => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Turnstile token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify token with Cloudflare
    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: Deno.env.get("TURNSTILE_SECRET_KEY"),
        response: token,
        // Optional: Add remote IP for additional security
        remoteip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      }),
    });

    const outcome = await result.json();

    if (!outcome.success) {
      console.error('Turnstile verification failed:', outcome);
      return new Response(JSON.stringify({
        error: "Invalid Turnstile token",
        details: outcome['error-codes'] || ['Unknown error']
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Token is valid - success
    return new Response(JSON.stringify({
      success: true,
      message: "Turnstile verification passed"
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return new Response(JSON.stringify({
      error: "Verification service error"
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
