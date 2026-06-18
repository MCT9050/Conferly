import { test, expect } from '@playwright/test';

/**
 * PRODUCTION RESCUE — Deep Diagnostic Suite
 *
 * Analyzes the production environment for the three known failure modes:
 *   1) Redirect Loop (www ↔ non-www)
 *   2) Auth/API 500s (NEXTAUTH_URL mismatch)
 *   3) React Runtime Errors / LiveKit failures
 *
 * Run with:
 *   BASE_URL=https://www.conferly.site npx playwright test tests/prod-rescue.spec.ts --project=chromium --workers=1
 *
 * This test does NOT fail on infrastructure issues — it reports them.
 * Failure means the test itself broke, not the production site.
 */

const BASE = process.env.BASE_URL || 'https://www.conferly.site';
const APEX = 'https://conferly.site';

// ============================================================================
// Helper: Extract Location header from a raw fetch (redirect: 'manual')
// ============================================================================
async function fetchLocationHeader(url: string): Promise<{
  finalUrl: string;
  status: number;
  locationHeader: string | null;
  allHeaders: Record<string, string>;
}> {
  const response = await fetch(url, { method: 'GET', redirect: 'manual' });
  const locationHeader = response.headers.get('location');
  const allHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    allHeaders[key] = value;
  });
  return {
    finalUrl: response.url,
    status: response.status,
    locationHeader,
    allHeaders,
  };
}

// ============================================================================
// Helper: Fetch JSON from production via page context (avoids redirect loop)
// ============================================================================
async function fetchJsonFromPage(
  page: import('@playwright/test').Page,
  url: string,
): Promise<{ status: number; body: Record<string, unknown>; headers: Record<string, string> }> {
  return page.evaluate(async (fetchUrl: string) => {
    try {
      const res = await fetch(fetchUrl, { redirect: 'manual' });
      const body = await res.json().catch(() => ({}));
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return { status: res.status, body, headers };
    } catch (e) {
      return { status: 0, body: { error: String(e) }, headers: {} };
    }
  }, url);
}

// ============================================================================
// Section 1: Redirect Trace — Apex vs WWW
// ============================================================================

test.describe('Redirect Analysis', () => {
  test('T1-REDIRECT: Trace conferly.site (apex) Location headers', async () => {
    // Step 1: Fetch the apex domain directly (no redirect following)
    const apex = await fetchLocationHeader(APEX);
    console.log(`[APEX-TRACE] GET ${APEX}`);
    console.log(`[APEX-TRACE]   Status:       ${apex.status}`);
    console.log(`[APEX-TRACE]   Final URL:    ${apex.finalUrl}`);
    console.log(`[APEX-TRACE]   Location:     ${apex.locationHeader ?? '(none)'}`);

    if (apex.locationHeader) {
      // Follow the redirect chain manually to detect loops
      const visited = new Set<string>();
      let currentUrl = apex.locationHeader;
      let loopDetected = false;
      let chain = [APEX, currentUrl];
      visited.add(APEX);

      for (let i = 0; i < 10; i++) {
        if (visited.has(currentUrl)) {
          loopDetected = true;
          console.warn(`[CRITICAL-FINDING] REDIRECT LOOP DETECTED!`);
          console.warn(`[CRITICAL-FINDING]   URL "${currentUrl}" visited twice in chain.`);
          console.warn(`[CRITICAL-FINDING]   Chain: ${chain.join(' → ')}`);
          break;
        }
        visited.add(currentUrl);
        const next = await fetchLocationHeader(currentUrl);
        chain.push(`(${next.status})`);
        if (next.locationHeader) {
          currentUrl = next.locationHeader;
          chain.push(currentUrl);
        } else {
          console.log(`[APEX-TRACE]   Terminal: ${currentUrl} → ${next.status}`);
          break;
        }
      }

      console.log(`[APEX-TRACE]   Full chain: ${chain.join(' → ')}`);
      expect(loopDetected).toBe(false);
    } else {
      // No redirect at all — this is fine if apex serves directly
      console.log(`[APEX-TRACE]   Apex serves directly (no redirect) — status ${apex.status}`);
    }
  });

  test('T2-REDIRECT: Trace www.conferly.site Location headers', async () => {
    const www = await fetchLocationHeader(BASE);
    console.log(`[WWW-TRACE] GET ${BASE}`);
    console.log(`[WWW-TRACE]   Status:       ${www.status}`);
    console.log(`[WWW-TRACE]   Final URL:    ${www.finalUrl}`);
    console.log(`[WWW-TRACE]   Location:     ${www.locationHeader ?? '(none)'}`);

    if (www.locationHeader) {
      const visited = new Set<string>();
      let currentUrl = www.locationHeader;
      let loopDetected = false;
      let chain = [BASE, `(${www.status})`, currentUrl];
      visited.add(BASE);

      for (let i = 0; i < 10; i++) {
        if (visited.has(currentUrl)) {
          loopDetected = true;
          console.warn(`[CRITICAL-FINDING] REDIRECT LOOP DETECTED FOR WWW!`);
          console.warn(`[CRITICAL-FINDING]   URL "${currentUrl}" visited twice.`);
          console.warn(`[CRITICAL-FINDING]   Chain: ${chain.join(' → ')}`);
          break;
        }
        visited.add(currentUrl);
        const next = await fetchLocationHeader(currentUrl);
        chain.push(`(${next.status})`);
        if (next.locationHeader) {
          currentUrl = next.locationHeader;
          chain.push(currentUrl);
        } else {
          console.log(`[WWW-TRACE]   Terminal: ${currentUrl} → ${next.status}`);
          break;
        }
      }

      console.log(`[WWW-TRACE]   Full chain: ${chain.join(' → ')}`);
      expect(loopDetected).toBe(false);
    } else {
      console.log(`[WWW-TRACE]   www serves directly (no redirect) — status ${www.status}`);
    }
  });

  test('T3-REDIRECT: Detect vercel.json misalignment (www vs non-www)', async () => {
    // Compare what vercel.json says vs actual behavior
    // vercel.json redirects: www → non-www (apex)
    const apex = await fetchLocationHeader(APEX);
    const www = await fetchLocationHeader(BASE);

    const apexRedirects = apex.locationHeader !== null;
    const wwwRedirects = www.locationHeader !== null;

    console.log(`[REDIRECT-CONFIG] vercel.json rule: www → non-www`);
    console.log(`[REDIRECT-CONFIG]   conferly.site redirects: ${apexRedirects ? 'YES → ' + apex.locationHeader : 'NO'}`);
    console.log(`[REDIRECT-CONFIG]   www.conferly.site redirects: ${wwwRedirects ? 'YES → ' + www.locationHeader : 'NO'}`);

    if (apexRedirects && wwwRedirects) {
      const loopMsgs = [
        'CRITICAL-FINDING: Both apex and www redirect to each other — INFINITE REDIRECT LOOP',
        'Root cause: vercel.json redirects www→apex, but Vercel domain config redirects apex→www',
        'Fix: Either change vercel.json to redirect apex→www (to match Vercel config),',
        '     or change Vercel domain settings to redirect www→apex (to match vercel.json).',
        '',
        `  vercel.json:  www.conferly.site → conferly.site (301)`,
        `  Vercel DNS:   conferly.site → www.conferly.site (implied)`,
      ];
      loopMsgs.forEach((m) => console.warn(`[${m}]`));
    } else if (apexRedirects && !wwwRedirects) {
      console.log(`[REDIRECT-CONFIG] Apex redirects to www, www serves directly.`);
      console.log(`[REDIRECT-CONFIG] vercel.json redirection (www→apex) appears INVERTED at DNS level.`);
    } else if (!apexRedirects && wwwRedirects) {
      console.log(`[REDIRECT-CONFIG] WWW redirects to apex, apex serves directly.`);
      console.log(`[REDIRECT-CONFIG] vercel.json rule is active (www→apex).`);
    } else {
      console.log(`[REDIRECT-CONFIG] Neither redirects — both serve content directly.`);
    }
  });
});

// ============================================================================
// Section 2: Auth & API Handshake
// ============================================================================

test.describe('Auth & API Handshake', () => {
  test('T4-AUTH: Visit /auth and intercept /api/auth/session', async ({ page }) => {
    const sessionCalls: { status: number; url: string; body: unknown }[] = [];

    // Intercept all API responses
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('/api/auth/session') || url.includes('/api/auth/csrf')) {
        sessionCalls.push({ status: res.status(), url, body: null });
      }
    });

    // Also capture response bodies
    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('/api/auth/session') || url.includes('/api/auth/csrf')) {
        try {
          const entry = sessionCalls.find((e) => e.url === url);
          if (entry) {
            const text = await res.text().catch(() => '(unreadable)');
            entry.body = text;
          }
        } catch {
          // ignore
        }
      }
    });

    try {
      await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (err) {
      const msg = err?.toString() || '';
      if (msg.includes('ERR_TOO_MANY_REDIRECTS')) {
        console.warn(`[CRITICAL-FINDING] /auth page cannot load — redirect loop active`);
        console.warn(`[CRITICAL-FINDING] Skipping auth session check (infrastructure issue)`);
        return;
      }
      console.error(`[AUTH-PAGE] Navigation error: ${msg}`);
      // Don't fail — just log
    }

    console.log(`[AUTH-SESSION] Captured ${sessionCalls.length} auth API call(s):`);
    for (const call of sessionCalls) {
      console.log(`[AUTH-SESSION]   ${call.status} ${call.url}`);
      if (call.body) {
        const bodyStr = typeof call.body === 'string' ? call.body : JSON.stringify(call.body);
        console.log(`[AUTH-SESSION]   Body: ${bodyStr.slice(0, 500)}`);
      }
    }

    // Check for auth session failures
    for (const call of sessionCalls) {
      if (call.status === 500) {
        console.error(`[CRITICAL-FINDING] /api/auth/session returned 500 — NEXTAUTH_URL mismatch or env issue`);
      } else if (call.status === 404) {
        console.error(`[CRITICAL-FINDING] /api/auth/session returned 404 — NextAuth route not found`);
      } else if (call.status >= 400) {
        console.warn(`[AUTH-WARN] /api/auth/session returned ${call.status} — may affect login`);
      } else if (call.status === 200) {
        console.log(`[AUTH-OK] /api/auth/session returned 200 — auth API healthy`);
      }
    }

    // Also check page content for auth form
    await page.waitForTimeout(2000); // Let any client-side errors settle
    const pageContent = await page.content().catch(() => '');
    const hasAuthForm = pageContent.includes('input') && pageContent.includes('email');
    console.log(`[AUTH-PAGE] Auth form rendered: ${hasAuthForm}`);
  });
});

// ============================================================================
// Section 3: Meeting Runtime Audit — Console Errors & React Errors
// ============================================================================

test.describe('Meeting Runtime Audit', () => {
  test('T5-MEETING: Navigate to /meeting and capture all console errors', async ({ page }) => {
    const consoleMessages: { type: string; text: string; location?: string }[] = [];
    const pageErrors: { message: string; stack?: string }[] = [];

    // Capture all console output
    page.on('console', (msg) => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
      };
      consoleMessages.push(entry);

      // Log everything to the test output
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[MEETING-CONSOLE:${msg.type()}] ${msg.text()}`);
      }
    });

    // Capture JS runtime exceptions
    page.on('pageerror', (err) => {
      pageErrors.push({ message: err.message, stack: err.stack });
      console.error(`[MEETING-PAGEERROR] ${err.message}`);
      if (err.stack) {
        const trace = err.stack.split('\n').slice(0, 6).join('\n    ');
        console.error(`[MEETING-PAGEERROR] Stack:    ${trace}`);
      }
    });

    // Flag specific known errors
    const knownErrorPatterns = [
      {
        pattern: /Minified React error #310/,
        label: 'React Hooks Rule Violation (hook order mismatch)',
        critical: true,
      },
      {
        pattern: /LiveKit connection failed/,
        label: 'LiveKit connection failure',
        critical: true,
      },
      {
        pattern: /LiveKit.*disconnected/,
        label: 'LiveKit disconnection',
        critical: false,
      },
      {
        pattern: /Cannot read properties of undefined/,
        label: 'Undefined property access',
        critical: true,
      },
      {
        pattern: /hydrat/i,
        label: 'React hydration mismatch',
        critical: true,
      },
      {
        pattern: /nextjs.*error/i,
        label: 'Next.js internal error boundary',
        critical: true,
      },
      {
        pattern: /401/i,
        label: 'Authentication error',
        critical: false,
      },
    ];

    try {
      await page.goto(`${BASE}/meeting?type=classroom`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });
    } catch (err) {
      const msg = err?.toString() || '';
      if (msg.includes('ERR_TOO_MANY_REDIRECTS')) {
        console.warn(`[CRITICAL-FINDING] /meeting page cannot load — redirect loop`);
        return;
      }
      console.error(`[MEETING-NAV] Error: ${msg}`);
    }

    // Wait for any late errors after hydration
    await page.waitForTimeout(5_000);

    // Analyze all console messages for known error patterns
    const findings: { pattern: string; label: string; critical: boolean }[] = [];
    for (const entry of consoleMessages) {
      for (const known of knownErrorPatterns) {
        if (known.pattern.test(entry.text) || known.pattern.test(entry.text.toLowerCase())) {
          findings.push({
            pattern: known.pattern.source,
            label: known.label,
            critical: known.critical,
          });
        }
      }
    }

    // Also check page errors
    for (const err of pageErrors) {
      for (const known of knownErrorPatterns) {
        if (known.pattern.test(err.message)) {
          findings.push({
            pattern: known.pattern.source,
            label: known.label,
            critical: known.critical,
          });
        }
      }
    }

    // Deduplicate
    const uniqueFindings = findings.filter(
      (f, i, arr) => arr.findIndex((x) => x.label === f.label) === i,
    );

    if (uniqueFindings.length > 0) {
      console.log(`\n[MEETING-FINDINGS] ${uniqueFindings.length} known issue(s) detected:`);
      for (const f of uniqueFindings) {
        const severity = f.critical ? 'CRITICAL' : 'WARNING';
        console.log(`  [${severity}] ${f.label} (pattern: ${f.pattern})`);
      }
    } else {
      console.log(`[MEETING-FINDINGS] No known error patterns detected`);
    }

    // Report totals
    const errors = consoleMessages.filter((m) => m.type === 'error');
    const warnings = consoleMessages.filter((m) => m.type === 'warning' || m.type === 'warn');
    console.log(`[MEETING-SUMMARY] Console: ${errors.length} errors, ${warnings.length} warnings, ${pageErrors.length} JS exceptions`);

    // If page loaded and no critical errors, consider it a pass
    const criticalFindings = uniqueFindings.filter((f) => f.critical);
    if (criticalFindings.length > 0) {
      console.warn(`[FAILURE-REPORT] ${criticalFindings.length} critical issue(s) that will break production:`);
      for (const f of criticalFindings) {
        console.warn(`  ❌ ${f.label}`);
      }
    }

    // Never fail the test on these — just report
  });
});

// ============================================================================
// Section 4: Heartbeat Proxy — All 7 Pillars
// ============================================================================

test.describe('Heartbeat API', () => {
  test('T6-HEARTBEAT: Fetch /api/heartbeat and report 7 pillars', async ({ page }) => {
    let status = 0;
    let body: Record<string, unknown> = {};
    let fetchError: string | null = null;

    // Try via page context first (avoids redirect loop in browser)
    try {
      // Navigate to base origin first
      try {
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      } catch {
        // If base page won't load, try evaluate anyway
      }

      const result = await fetchJsonFromPage(page, `${BASE}/api/heartbeat`);
      status = result.status;
      body = result.body;
      console.log(`[HEARTBEAT] Via page context: ${status}`);
    } catch (e) {
      fetchError = String(e);
      console.error(`[HEARTBEAT] Page context failed: ${fetchError}`);
    }

    // Fallback: direct Node.js fetch
    if (status === 0) {
      try {
        const res = await fetch(`${BASE}/api/heartbeat`, { redirect: 'manual' });
        status = res.status;
        body = await res.json().catch(() => ({}));
        console.log(`[HEARTBEAT] Via direct fetch: ${status}`);
      } catch (e) {
        fetchError = String(e);
        console.error(`[HEARTBEAT] Direct fetch also failed: ${fetchError}`);
      }
    }

    // Report
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║        PRODUCTION HEARTBEAT RESULT                          ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝`);

    if (status === 0) {
      console.error(`[HEARTBEAT-FAIL] Cannot reach ${BASE}/api/heartbeat`);
      console.error(`[HEARTBEAT-FAIL] Last error: ${fetchError}`);
      if (fetchError?.includes('redirect')) {
        console.warn(`[CRITICAL-FINDING] Heartbeat blocked by redirect loop`);
      }
      return;
    }

    console.log(`[HEARTBEAT] HTTP ${status}`);
    console.log(`[HEARTBEAT] Body:`);
    console.log(JSON.stringify(body, null, 2));

    // Analyze response structure
    if (body.overall) {
      console.log(`[HEARTBEAT] Overall status: ${body.overall}`);
    }

    if (body.pillars && Array.isArray(body.pillars)) {
      const pillars = body.pillars as Array<{ name: string; status: string; detail?: string }>;
      const passing = pillars.filter((p) => p.status === 'pass' || p.status === 'ok').length;
      const failing = pillars.filter((p) => p.status === 'fail' || p.status === 'error').length;

      console.log(`[HEARTBEAT] Pillars: ${passing} passing, ${failing} failing of ${pillars.length}`);

      console.log(`\n  Pillar breakdown:`);
      for (const p of pillars) {
        const icon = p.status === 'pass' || p.status === 'ok' ? ' ✅' : ' ❌';
        console.log(`  ${icon}  ${p.name.padEnd(35)}  ${p.status} — ${p.detail || ''}`);
      }

      if (failing > 0) {
        console.warn(`\n[CRITICAL-FINDING] ${failing} pillar(s) are failing:`);
        for (const p of pillars) {
          if (p.status === 'fail' || p.status === 'error') {
            console.warn(`  ❌ ${p.name}: ${p.detail || 'no details'}`);
          }
        }
      }
    } else {
      console.log(`[HEARTBEAT] Response does not contain expected pillars array`);
    }

    console.log(`\n${'─'.repeat(58)}`);
    console.log(`  Timestamp: ${body.timestamp || new Date().toISOString()}`);
    console.log(`${'─'.repeat(58)}`);

    // Never fail the test — just report findings
  });
});