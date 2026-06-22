import { test, expect } from '@playwright/test';

const BASE_URL = 'https://www.conferly.site';

test.describe('LiveKit Token Handshake', () => {
  test('LK-001: Direct /auth → meeting navigation + React error capture', async ({ page }) => {
    test.setTimeout(120_000); // Extended for Vercel cold starts

    // ── Collect console errors (catches React #300, hydration mismatches) ──
    const consoleErrors: { type: string; text: string }[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ type: msg.type(), text: msg.text() });
        console.log(`[CONSOLE_ERROR] ${msg.text()}`);
      }
    });

    // Catch uncaught page errors (React crash bubbles)
    page.on('pageerror', (err) => {
      console.log(`[PAGE_ERROR] ${err.message}`);
      consoleErrors.push({ type: 'pageerror', text: err.message });
    });

    // ── Step 1: Navigate directly to /auth ────────────────────────────────
    console.log('[LK_TEST] Navigating to /auth...');
    const authResponse = await page.goto(`${BASE_URL}/auth`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });

    console.log(`[LK_TEST] /auth status: ${authResponse?.status()}`);
    expect(authResponse?.status()).toBe(200);

    // Log any React errors that fired during /auth load
    if (consoleErrors.length > 0) {
      console.log(`[LK_TEST] ⚠ ${consoleErrors.length} console error(s) detected on /auth`);
      consoleErrors.forEach((e) => console.log(`  [${e.type}] ${e.text.slice(0, 300)}`));
    }

    // Check for React #300 specifically (hydration mismatch)
    const react300Errors = consoleErrors.filter(
      (e) => e.text.includes('Minified React error #300') || e.text.includes('hydration')
    );
    if (react300Errors.length > 0) {
      console.log('[LK_TEST] ❌ React hydration mismatch detected (Error #300)');
      console.log('[LK_TEST]    This means server-rendered HTML does not match the client output.');
      console.log('[LK_TEST]    Likely cause: client-only content (e.g., date, user state, localStorage)');
      console.log('[LK_TEST]    rendered during SSR differs from what the browser hydrates.');
      console.log('[LK_TEST]    Fix: wrap dynamic content in useEffect or suppressHydrationWarning.');
    }

    // ── Step 2: Navigate to meeting room ──────────────────────────────────
    console.log('[LK_TEST] Navigating to /meeting?room=DEBUG&type=classroom...');
    const meetingResponse = await page.goto(
      `${BASE_URL}/meeting?room=DEBUG&type=classroom`,
      { waitUntil: 'networkidle', timeout: 60_000 }
    );
    console.log(`[LK_TEST] Meeting page status: ${meetingResponse?.status()}`);

    // ── Step 3: Intercept /api/lk-token calls ─────────────────────────────
    const lkTokenResponses: { status: number; body: string }[] = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/lk-token')) {
        const status = response.status();
        let body = '';
        try {
          body = await response.text();
        } catch {
          body = '<unreadable>';
        }
        lkTokenResponses.push({ status, body });
        console.log(`[LK_TEST] /api/lk-token response: ${status}`, body.slice(0, 500));
      }
    });

    // Wait for potential lk-token calls
    await page.waitForTimeout(8_000);

    // ── Step 4: Report results ────────────────────────────────────────────
    if (lkTokenResponses.length === 0) {
      console.log('[LK_TEST] ⚠ No /api/lk-token requests detected — user may not be authenticated');
    } else {
      const last = lkTokenResponses[lkTokenResponses.length - 1];
      console.log(`[LK_TEST] Final /api/lk-token: HTTP ${last.status}`);
      if (last.status === 500) {
        console.log(`[LK_TEST] ❌ 500 body: ${last.body}`);
      } else if (last.status === 200) {
        console.log('[LK_TEST] ✅ Token OK');
      }
    }

    // ── Step 5: Print React error summary ─────────────────────────────────
    if (react300Errors.length > 0) {
      console.log('[LK_TEST] === REACT HYDRATION ERROR #300 PRESENT ===');
      console.log('[LK_TEST] Investigate SSR vs client content mismatch on /auth or /meeting');
    } else {
      console.log('[LK_TEST] ✅ No React #300 hydration errors detected');
    }

    console.log('[LK_TEST] Final URL:', page.url());
  });
});