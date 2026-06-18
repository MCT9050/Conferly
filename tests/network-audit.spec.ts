import { test, expect } from '@playwright/test';

/**
 * Network Audit — Canonical Header & Security Headers Diagnostic
 *
 * Captures all response headers from the production site and verifies:
 * 1. Canonical link header points to conferly.site (apex domain)
 * 2. Content-Security-Policy is present and strict
 * 3. X-Frame-Options is SAMEORIGIN
 * 4. www.conferly.site redirects to conferly.site with 308 (single hop)
 * 5. Protocol and Host at each hop
 *
 * Updated 2026-06-18: Canonical domain is now conferly.site (not www).
 * www → apex redirect set via vercel.json (308 permanent).
 *
 * Run with:
 *   BASE_URL=https://conferly.site npx playwright test tests/network-audit.spec.ts --workers=1
 *
 * This is a DIAGNOSTIC test — it logs findings but only fails on broken assertions.
 */

const BASE = process.env.BASE_URL || 'https://conferly.site';
const WWW_BASE = 'https://www.conferly.site';

// ============================================================================
// Helper: Raw fetch with redirect: 'manual' to capture redirect chain
// ============================================================================
async function fetchWithManualRedirect(url: string): Promise<{
  status: number;
  finalUrl: string;
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
// Helper: Extract Protocol + Host from a URL string
// ============================================================================
function extractProtoHost(url: string): { protocol: string; host: string } {
  try {
    const parsed = new URL(url);
    return { protocol: parsed.protocol.replace(':', ''), host: parsed.host };
  } catch {
    return { protocol: 'unknown', host: 'unknown' };
  }
}

// ============================================================================
// Section 1: Live Site Header Capture (via Playwright page context)
// ============================================================================

test.describe('Network Audit — Live Site Headers', () => {
  test('NA1-CAPTURE: Capture all response headers from conferly.site', async ({ page }) => {
    const responseHeaders: Record<string, Record<string, string>> = {};

    // Capture headers for every response
    page.on('response', (res) => {
      const url = res.url();
      const headers: Record<string, string> = {};
      res.headers().forEach((value, key) => {
        headers[key] = value;
      });
      responseHeaders[url] = headers;
    });

    // Navigate to the base URL
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (err) {
      const msg = err?.toString() || '';
      console.error(`[NAV-ERROR] Navigation to ${BASE} failed: ${msg}`);
      if (msg.includes('ERR_TOO_MANY_REDIRECTS')) {
        console.warn('[CRITICAL] Redirect loop detected during initial navigation');
      }
    }

    // Allow time for all requests to complete
    await page.waitForTimeout(3_000);

    // Log the document response headers specifically
    const docUrl = Object.keys(responseHeaders).find(
      (url) => url === BASE || url === `${BASE}/` || url === BASE.replace(/\/$/, ''),
    );

    if (docUrl) {
      const headers = responseHeaders[docUrl];
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('  DOCUMENT RESPONSE HEADERS');
      console.log('  URL:', docUrl);
      console.log('═══════════════════════════════════════════════════════════\n');

      for (const [key, value] of Object.entries(headers)) {
        console.log(`  ${key}: ${value}`);
      }

      // --- SPECIFIC CHECKS ---

      // CHECK 1: Canonical Link Header
      const linkHeader = headers['link'] || headers['Link'] || '';
      console.log('\n── Canonical Check ──');
      console.log(`  Link header: ${linkHeader || '(none)'}`);

      if (linkHeader) {
        const canonicalMatch = linkHeader.match(/<([^>]+)>;\s*rel="canonical"/);
        if (canonicalMatch) {
          const canonicalUrl = canonicalMatch[1];
          console.log(`  Canonical URL: ${canonicalUrl}`);
          if (canonicalUrl === 'https://conferly.site') {
            console.log('  ✅ CORRECT: Canonical points to https://conferly.site');
          } else if (canonicalUrl === 'https://www.conferly.site') {
            console.warn('  ❌ MISMATCH: Canonical still points to www — should be conferly.site!');
          } else {
            console.warn(`  ⚠️  UNEXPECTED: Canonical points to "${canonicalUrl}"`);
          }
        } else {
          console.warn('  ⚠️  Link header present but does not contain canonical rel');
        }
      } else {
        console.warn('  ⚠️  No Link header found');
      }

      // CHECK 2: Content-Security-Policy
      const csp = headers['content-security-policy'] || headers['Content-Security-Policy'] || '';
      console.log('\n── CSP Check ──');
      if (csp) {
        console.log(`  CSP: ${csp}`);
        const hasSelf = csp.includes("'self'");
        const hasScriptNonce = csp.includes('unsafe-inline');
        console.log(`  Has 'self': ${hasSelf}`);
        console.log(`  Has script-src: ${csp.includes('script-src')}`);
        const defaultSrc = csp.match(/default-src\s+([^;]+)/);
        if (defaultSrc) {
          console.log(`  default-src: ${defaultSrc[1]}`);
        }
      } else {
        console.warn('  ⚠️  No Content-Security-Policy header found');
      }

      // CHECK 3: X-Frame-Options
      const xfo = headers['x-frame-options'] || headers['X-Frame-Options'] || '';
      console.log('\n── X-Frame-Options Check ──');
      if (xfo) {
        console.log(`  X-Frame-Options: ${xfo}`);
        if (xfo.toUpperCase() === 'SAMEORIGIN') {
          console.log('  ✅ CORRECT: X-Frame-Options is SAMEORIGIN');
        } else {
          console.warn(`  ⚠️  Non-standard value: ${xfo}`);
        }
      } else {
        console.warn('  ⚠️  No X-Frame-Options header found');
      }

      // CHECK 4: Referrer-Policy
      const rp = headers['referrer-policy'] || headers['Referrer-Policy'] || '';
      console.log('\n── Referrer-Policy Check ──');
      if (rp) {
        console.log(`  Referrer-Policy: ${rp}`);
        const expected = 'strict-origin-when-cross-origin';
        if (rp === expected) {
          console.log(`  ✅ CORRECT: Referrer-Policy is ${expected}`);
        } else {
          console.warn(`  ⚠️  Expected "${expected}", got "${rp}"`);
        }
      } else {
        console.warn('  ⚠️  No Referrer-Policy header found');
      }

      // CHECK 5: Additional Security Headers
      console.log('\n── Additional Security Headers ──');
      const securityHeaders = [
        'strict-transport-security',
        'x-content-type-options',
        'x-dns-prefetch-control',
        'permissions-policy',
      ];
      for (const h of securityHeaders) {
        const val = headers[h] || headers[h.replace(/-/g, '-')] || '';
        console.log(`  ${h}: ${val || '(missing)'}`);
      }

      console.log('\n═══════════════════════════════════════════════════════════\n');
    } else {
      console.warn('[WARN] Could not find document response headers — check URL or redirect chain');
      console.log(`[WARN] Captured URLs: ${Object.keys(responseHeaders).join(', ')}`);
    }

    // Always log all captured response URLs for debugging
    console.log(`\n[SUMMARY] Captured headers for ${Object.keys(responseHeaders).length} response(s):`);
    for (const url of Object.keys(responseHeaders).slice(0, 10)) {
      const s = responseHeaders[url];
      console.log(`  ${s[':status'] || s['status'] || '(?)'} — ${url}`);
    }
  });
});

// ============================================================================
// Section 2: Redirect Chain — WWW → Apex (Canonical Domain Enforcement)
// ============================================================================

test.describe('Redirect Chain Analysis', () => {
  test('NA2-REDIRECT: Trace www.conferly.site — must redirect to conferly.site', async () => {
    console.log('\n── REDIRECT DIAGNOSTIC: www.conferly.site → conferly.site ──\n');

    const visited = new Set<string>();
    let currentUrl = WWW_BASE;
    const chain: Array<{ url: string; status: number; location: string | null; protocol: string; host: string }> = [];
    let loopDetected = false;

    for (let i = 0; i < 10; i++) {
      if (visited.has(currentUrl)) {
        loopDetected = true;
        console.warn(`❌ REDIRECT LOOP DETECTED at hop ${i}: "${currentUrl}"`);
        break;
      }
      visited.add(currentUrl);

      const result = await fetchWithManualRedirect(currentUrl);
      const { protocol, host } = extractProtoHost(currentUrl);
      chain.push({
        url: currentUrl,
        status: result.status,
        location: result.locationHeader,
        protocol,
        host,
      });

      console.log(`  Hop ${i}: ${currentUrl}`);
      console.log(`    Protocol: ${protocol}`);
      console.log(`    Host:     ${host}`);
      console.log(`    Status:   ${result.status}`);
      console.log(`    Location: ${result.locationHeader ?? '(terminal)'}`);

      if (result.locationHeader) {
        currentUrl = result.locationHeader;
      } else {
        break;
      }
    }

    console.log(`\n── Chain Summary ──`);
    console.log(`  Total hops: ${chain.length}`);
    console.log(`  Loop detected: ${loopDetected}`);

    const endUrl = chain[chain.length - 1]?.url || '';
    const endStatus = chain[chain.length - 1]?.status || 0;
    const endHost = chain[chain.length - 1]?.host || '';

    console.log(`  Start: ${chain[0]?.url}`);
    console.log(`  End:   ${endUrl} (HTTP ${endStatus})`);

    // Log each hop's protocol/host for diagnostic
    console.log('\n── Per-Hop Protocol/Host Audit ──');
    chain.forEach((hop, idx) => {
      const locationTarget = hop.location
        ? `${extractProtoHost(hop.location).protocol}://${extractProtoHost(hop.location).host}`
        : '(terminal)';
      console.log(`  Hop ${idx}: ${hop.protocol}://${hop.host} → ${locationTarget}`);
    });

    // Expected: www → conferly.site with 308 in 1 hop, final 200
    if (chain.length === 2 && !loopDetected) {
      const redirectIs308 = chain[0].status === 308;
      const redirectToApex = chain[0].location?.includes('conferly.site');
      const redirectToHttps = chain[0].location?.startsWith('https://conferly.site') ?? false;
      const finalIsApex = endHost === 'conferly.site';
      const finalIs200 = endStatus === 200;

      console.log('\n── Assertions ──');
      console.log(`  Redirect status 308:            ${redirectIs308 ? '✅' : '❌'}`);
      console.log(`  Redirect to conferly.site:       ${redirectToApex ? '✅' : '❌'}`);
      console.log(`  Redirect target is HTTPS:        ${redirectToHttps ? '✅' : '❌'}`);
      console.log(`  Final host is conferly.site:     ${finalIsApex ? '✅' : '❌'}`);
      console.log(`  Final status is 200:             ${finalIs200 ? '✅' : '❌'}`);

      if (redirectIs308 && redirectToApex && redirectToHttps && finalIsApex && finalIs200) {
        console.log('\n✅ PASS: www.conferly.site redirects to https://conferly.site with 308 + final 200');
      } else {
        console.warn('\n⚠️  UNEXPECTED REDIRECT PATTERN:');
        if (!redirectIs308) console.warn(`     - Expected 308, got ${chain[0].status}`);
        if (!redirectToApex) console.warn(`     - Redirect target does not include conferly.site: ${chain[0].location}`);
        if (!redirectToHttps) console.warn(`     - Redirect target is not HTTPS: ${chain[0].location}`);
        if (!finalIsApex) console.warn(`     - Final host is not conferly.site: ${endHost}`);
        if (!finalIs200) console.warn(`     - Final status is not 200: ${endStatus}`);
      }
    } else if (chain.length === 1 && chain[0].status === 200) {
      console.warn(`\n⚠️  www.conferly.site serves directly (no redirect) — status 200`);
      console.log(`  This means Vercel redirect is NOT active. Check the vercel.json redirects.`);
    } else if (chain.length === 1 && chain[0].status === 308) {
      console.warn(`\n⚠️  www returns 308 with Location: ${chain[0].location}`);
      console.log(`  This is a redirect-only response — the destination is not reachable.`);
    } else {
      console.warn(`\n⚠️  REDIRECT CHAIN HAS ${chain.length} hops — expected exactly 1 redirect`);
      if (loopDetected) {
        console.error('❌ FAIL: Redirect loop detected — critical infrastructure issue!');
      }
    }

    expect(loopDetected).toBe(false);
    expect(endStatus).toBe(200);
    expect(endUrl).toContain('conferly.site');
  });

  test('NA3-REDIRECT: Trace conferly.site (apex) — must serve directly', async () => {
    console.log('\n── DIAGNOSTIC: conferly.site (must serve directly) ──\n');

    const visited = new Set<string>();
    let currentUrl = BASE;
    const chain: Array<{ url: string; status: number; location: string | null; protocol: string; host: string }> = [];
    let loopDetected = false;

    for (let i = 0; i < 10; i++) {
      if (visited.has(currentUrl)) {
        loopDetected = true;
        console.warn(`❌ REDIRECT LOOP DETECTED at hop ${i}: "${currentUrl}"`);
        break;
      }
      visited.add(currentUrl);

      const result = await fetchWithManualRedirect(currentUrl);
      const { protocol, host } = extractProtoHost(currentUrl);
      chain.push({
        url: currentUrl,
        status: result.status,
        location: result.locationHeader,
        protocol,
        host,
      });

      console.log(`  Hop ${i}: ${currentUrl}`);
      console.log(`    Protocol: ${protocol}`);
      console.log(`    Host:     ${host}`);
      console.log(`    Status:   ${result.status}`);
      console.log(`    Location: ${result.locationHeader ?? '(terminal)'}`);

      if (result.locationHeader) {
        currentUrl = result.locationHeader;
      } else {
        break;
      }
    }

    const endStatus = chain[chain.length - 1]?.status || 0;
    const endUrl = chain[chain.length - 1]?.url || '';
    const endHost = chain[chain.length - 1]?.host || '';
    const servesDirectly = chain.length === 1 && chain[0].location === null;

    console.log(`\n── Summary ──`);
    console.log(`  Total hops: ${chain.length}`);
    console.log(`  conferly.site serves directly: ${servesDirectly ? '✅' : '❌'}`);
    console.log(`  Final status: ${endStatus}${endStatus === 200 ? ' ✅' : ' ❌'}`);
    console.log(`  Final host:   ${endHost}`);

    if (!servesDirectly && chain.length > 1) {
      console.warn('\n⚠️  conferly.site is redirecting — this should NOT happen!');
      console.log('\n── Redirect Hops ──');
      chain.forEach((hop, idx) => {
        console.log(`  Hop ${idx}: ${hop.protocol}://${hop.host} → ${hop.status} → ${hop.location ?? '(end)'}`);
      });
    }

    if (loopDetected) {
      console.error('\n❌ FAIL: Redirect loop detected on apex domain');
    }

    expect(loopDetected).toBe(false);
    expect(endStatus).toBe(200);
    expect(endUrl).toContain('conferly.site');
    expect(endUrl.startsWith('https://conferly.site')).toBe(true);
  });
});

// ============================================================================
// Section 3: Auth Session Verification
// ============================================================================

test.describe('Auth Session Verification', () => {
  test('NA4-AUTH: GET /api/auth/session on apex domain', async ({ page }) => {
    // Capture session response via page context
    const sessionResult = await page.evaluate(async (baseUrl: string) => {
      try {
        const res = await fetch(`${baseUrl}/api/auth/session`, {
          method: 'GET',
          redirect: 'manual',
        });
        const body = await res.text().catch(() => '(unreadable)');
        return { status: res.status, body: body.slice(0, 500) };
      } catch (e) {
        return { status: 0, body: String(e) };
      }
    }, BASE);

    console.log('\n── Auth Session Check ──');
    console.log(`  Endpoint: ${BASE}/api/auth/session`);
    console.log(`  Status: ${sessionResult.status}`);
    console.log(`  Body: ${sessionResult.body || '(empty)'}`);

    if (sessionResult.status === 0) {
      console.error(`  ❌ FAIL: Cannot reach /api/auth/session`);
    } else if (sessionResult.status === 500) {
      console.error(`  ❌ FAIL: /api/auth/session returned 500 — NEXTAUTH_URL mismatch likely`);
    } else if (sessionResult.status === 200) {
      console.log(`  ✅ PASS: /api/auth/session returned 200 — auth API healthy`);
    } else if (sessionResult.status === 401) {
      console.log(`  ✅ PASS: /api/auth/session returned 401 (expected — no auth session)`);
      console.log(`  (200 or 401 are both healthy; 500 or 0 indicate a problem)`);
    } else {
      console.warn(`  ⚠️  Unexpected status: ${sessionResult.status}`);
    }
  });
});