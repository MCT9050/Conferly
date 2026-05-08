
================================================================================
RATE LIMITING & BRUTE FORCE PROTECTION STRATEGY
================================================================================

Frontend Implementation (localStorage-based):
- Login attempt tracking with 5-minute lockout after 5 failed attempts
- RateLimiter class tracks attempts per email

Backend/Infrastructure (handled by):
- Supabase Auth: Built-in rate limiting (5 attempts per IP per minute)
- Cloudflare WAF: Challenge on suspicious traffic
- Cloudflare Turnstile: Bot detection

Note: Full rate limiting requires edge/server implementation.

