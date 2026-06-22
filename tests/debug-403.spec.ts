import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://www.conferly.site';

// ============================================================================
// DEBUG-403: Full diagnostic for the /api/lk-token 403 Forbidden failure
// ============================================================================
// Targeting: SUPABASE-AUTH codebase (no NextAuth).
// Captures:
//   1. Auth state — checks /dashboard redirect behavior (Supabase cookie presence)
//   2. Full response body when /api/lk-token returns 403
//   3. Whether the failure is Auth (no cookies) vs Authorization (room access)
// ============================================================================

test.describe('403 Debug Diagnostic — /api/lk-token', () => {
  test('D403-1: Auth state check — dashboard redirect indicates session presence', async ({ page }) => {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  TASK 1.1: AUTH STATE CHECK (Supabase cookies)');
    console.log('═══════════════════════════════════════════════════════════');

    // Visit dashboard — if redirected to /auth, user is NOT logged in
    const response = await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    const finalUrl = page.url();

    console.log(`  Final URL: ${finalUrl}`);
    console.log(`  Status: ${response?.status()}`);

    // Check cookies for presence of Supabase auth cookies
    const cookies = await page.context().cookies();
    const supabaseCookies = cookies.filter(
      (c) => c.name.includes('sb-') || c.name.includes('supabase') || c.name.includes('access-token')
    );
    console.log(`  Supabase cookies found: ${supabaseCookies.length}`);
    supabaseCookies.forEach((c) => {
      console.log(`    ${c.name}: domain=${c.domain}, path=${c.path}`);
    });

    if (finalUrl.includes('/auth') || finalUrl.includes('/signin')) {
      console.log('  ❌ REDIRECTED TO AUTH: User is NOT authenticated (no valid Supabase session)');
      console.log('     → Any lk-token request will fail because getServerSession() returns null.');
    } else if (response?.status() === 200) {
      console.log('  ✅ DASHBOARD LOADED: User appears to be authenticated.');
      console.log('     → Supabase session cookie is present and valid.');
    } else {
      console.log(`  ⚠️  UNEXPECTED: Status ${response?.status()} on ${finalUrl}`);
    }

    // This is informational — both outcomes are valid test results
    expect(true).toBe(true);
  });

  test('D403-2: Trigger /api/lk-token and capture response body', async ({ page }) => {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  TASK 1.2: INTERCEPT /api/lk-token response');
    console.log('═══════════════════════════════════════════════════════════');

    let lkStatus = 0;
    let lkBody = '';
    let lkCaptured = false;

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/lk-token')) {
        lkStatus = response.status();
        try {
          lkBody = await response.text();
        } catch {
          lkBody = '<unreadable>';
        }
        lkCaptured = true;
        console.log(`\n[LK_RESPONSE] Status: ${lkStatus}`);
        console.log(`[LK_RESPONSE] Body: ${lkBody.slice(0, 500)}`);
      }
    });

    // Also log request headers for the lk-token call
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/lk-token')) {
        const headers = request.headers();
        console.log(`\n[LK_REQUEST] ${request.method()} ${url}`);
        console.log(`  Content-Type: ${headers['content-type'] || '(none)'}`);
        console.log(`  Cookie present: ${!!headers['cookie']}`);
        if (headers['cookie']) {
          const c = headers['cookie'] as string;
          console.log(`  Has supabase cookie: ${c.includes('sb-') || c.includes('supabase')}`);
        }
      }
    });

    // Navigate to meeting page to trigger lk-token request
    await page.goto(`${BASE_URL}/meeting?room=DEBUG`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for any lk-token requests
    await page.waitForTimeout(5000);

    if (!lkCaptured) {
      console.log('[LK_TEST] No lk-token request captured from page load.');
      console.log('[LK_TEST] Trying direct fetch from browser context...');

      const directResult = await page.evaluate(async (baseUrl: string) => {
        try {
          const res = await fetch(`${baseUrl}/api/lk-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ roomId: 'DEBUG', role: 'participant' }),
          });
          const body = await res.text();
          return { status: res.status, body: body.slice(0, 500) };
        } catch (e) {
          return { status: 0, body: String(e) };
        }
      }, BASE_URL);

      lkStatus = directResult.status;
      lkBody = directResult.body;
      console.log(`[DIRECT_FETCH] Status: ${lkStatus}`);
      console.log(`[DIRECT_FETCH] Body: ${lkBody}`);
    }

    // ── Analysis ──
    console.log(`\n═══ ANALYSIS ═══`);
    console.log(`  Final status: ${lkStatus}`);
    console.log(`  Body: ${lkBody.slice(0, 300) || '(empty)'}`);

    if (lkStatus === 403) {
      console.log('  → 403 FORBIDDEN: User is authenticated but lacks room access.');
      console.log('    verifyRoomAccess() returned null — user not in meeting_participants.');
      console.log('    Fix: Add user to meeting_participants, or set meeting.is_public = true.');
    } else if (lkStatus === 401) {
      console.log('  → 401 UNAUTHORIZED: Session missing or invalid.');
      console.log('    getServerSession() returned null — user not logged in.');
    } else if (lkStatus === 200) {
      console.log('  ✅ 200 OK: Token request succeeded — no 403 issue.');
    } else if (lkStatus === 0) {
      console.log('  → No response captured — test couldn\'t reach the API.');
    } else {
      console.log(`  → Unexpected status: ${lkStatus}`);
    }

    // The test passes regardless — it's a diagnostic
    expect(lkStatus).toBeGreaterThanOrEqual(0);
  });
});