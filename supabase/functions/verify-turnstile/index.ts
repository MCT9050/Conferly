// Cloudflare Turnstile Verification Edge Function
// Validates Turnstile tokens before allowing Supabase auth

Deno.serve(async (req) => {
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

    // Get Turnstile secret key from environment variables
    const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
    
    if (!secretKey) {
      console.error('TURNSTILE_SECRET_KEY not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify token with Cloudflare
    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        // Optional: Add remote IP for additional security
        remoteip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      }),
    });

    const outcome = await result.json();

    if (!outcome.success) {
      console.error('Turnstile verification failed:', outcome);
      return new Response(JSON.stringify({ 
        error: 'Security verification failed',
        details: outcome['error-codes'] || ['Unknown error']
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Token is valid - success
    console.log('Turnstile verification successful');
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Security verification passed'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Turnstile verification error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error during verification'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
