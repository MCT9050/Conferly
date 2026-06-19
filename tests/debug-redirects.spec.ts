/**
 * debug-redirects.spec.ts
 * Diagnostic test to map the exact redirect chain for www.conferly.site and identify
 * which provider (Cloudflare or Vercel) is issuing each redirect.
 *
 * Usage: npx playwright test tests/debug-redirects.spec.ts --headed
 */

import { test, expect } from '@playwright/test';

const TARGET = 'https://www.conferly.site';

test.describe('Redirect Chain Trace — www.conferly.site', () => {
  test('TASK-1: Log every hop in the redirect chain with provider headers', async ({ page }) => {
    const hopLog: Array<{
      url: string;
      status: number | null;
      location: string | null;
      server: string | null;
      cfRay: string | null;
      xVercelId: string | null;
    }> = [];

    // Intercept every response to capture redirect hops
    page.on('response', async (response) => {
      const request = response.request();
      const url = request.url();
      const status = response.status();
      const headers = response.headers();

      // Only log entries that are either redirects or the final response
      const location = response.headers()['location'];
      if (location || status < 400) {
        hopLog.push({
          url,
          status,
          location: location || null,
          server: headers['server'] || null,
          cfRay: headers['cf-ray'] || null,
          xVercelId: headers['x-vercel-id'] || null,
        });
      }
    });

    // Navigate — do NOT follow redirects automatically
    let finalUrl: string | null = null;
    let finalStatus: number | null = null;

    try {
      const response = await page.goto(TARGET, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      });
      finalUrl = page.url();
      finalStatus = response?.status() ?? null;
    } catch (err: any) {
      // Likely a redirect loop — capture what we have
      finalUrl = page.url();
      finalStatus = null;
      console.log(`\n[LOOP DETECTED] ${err.message}`);
    }

    // Print the full hop chain
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║          REDIRECT CHAIN TRACE — www.conferly.site       ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    hopLog.forEach((hop, i) => {
      const provider =
        hop.xVercelId && hop.cfRay
          ? '🟣 BOTH (Cloudflare + Vercel)'
          : hop.cfRay
            ? '🟠 Cloudflare'
            : hop.xVercelId
              ? '🟢 Vercel'
              : '⚪ Unknown';

      console.log(`Hop ${i + 1}:`);
      console.log(`  URL:      ${hop.url}`);
      console.log(`  Status:   ${hop.status ?? 'n/a'} ${hop.location ? `→ ${hop.location}` : ''}`);
      console.log(`  Server:   ${hop.server ?? 'n/a'}`);
      console.log(`  cf-ray:   ${hop.cfRay ?? 'n/a'}`);
      console.log(`  x-vercel-id: ${hop.xVercelId ?? 'n/a'}`);
      console.log(`  Provider: ${provider}`);
      console.log('');
    });

    console.log(`Final URL:    ${finalUrl}`);
    console.log(`Final Status: ${finalStatus ?? 'n/a (loop)'}`);
    console.log(`Total hops:   ${hopLog.length}`);
    console.log('');

    // ── Analysis ──────────────────────────────────────────────────────────────
    const hasLoop = hopLog.length > 5;
    const hasWwwToApex = hopLog.some(
      (h) => h.location?.includes('conferly.site/') && !h.location?.includes('www.')
    );
    const hasApexToWww = hopLog.some(
      (h) => h.location?.includes('www.conferly.site')
    );

    if (hasLoop) {
      console.log('⚠️  INFINITE REDIRECT LOOP DETECTED');
      console.log(`    Loop pattern: www → apex → www (${hopLog.length} hops before curl limit)`);
    }

    if (hasWwwToApex && hasApexToWww) {
      console.log('⚠️  TWO-WAY REDIRECT CONFLICT DETECTED:');
      console.log('    Hop A: www.conferly.site → conferly.site   (likely Cloudflare Page Rule)');
      console.log('    Hop B: conferly.site → www.conferly.site   (likely Vercel domain config)');
    }

    // Log provider attribution for each redirect
    console.log('\n── Provider Attribution ──');
    for (const hop of hopLog) {
      if (hop.location) {
        if (hop.cfRay && hop.xVercelId) {
          console.log(
            `  ⚠️  STATUS ${hop.status} → ${hop.location}: BOTH cf-ray="${hop.cfRay}" AND x-vercel-id="${hop.xVercelId}" — CLOUDFLARE PROXY + VERCEL ORIGIN`
          );
        } else if (hop.cfRay) {
          console.log(
            `  🟠 STATUS ${hop.status} → ${hop.location}: Cloudflare (cf-ray: ${hop.cfRay})`
          );
        } else if (hop.xVercelId) {
          console.log(
            `  🟢 STATUS ${hop.status} → ${hop.location}: Vercel (x-vercel-id: ${hop.xVercelId})`
          );
        }
      }
    }

    // Assert — we expect the loop to be present right now (we're diagnosing, not asserting fix)
    expect(hopLog.length).toBeGreaterThan(0);
  });

  test('TASK-1B: Raw fetch with redirect:manual to capture exact headers', async () => {
    console.log('\n── Raw fetch with redirect:manual ──\n');

    // Follow up to 10 hops manually
    const chain: Array<{ url: string; status: number; location: string | null; headers: Record<string, string> }> = [];
    const visited = new Set<string>();

    let currentUrl = TARGET;
    const MAX_HOPS = 10;

    for (let hop = 0; hop < MAX_HOPS; hop++) {
      if (visited.has(currentUrl)) {
        console.log('🔴 LOOP: URL already visited in chain — breaking');
        break;
      }
      visited.add(currentUrl);

      try {
        const res = await fetch(currentUrl, { method: 'HEAD', redirect: 'manual' } as any);
        const headers: Record<string, string> = {};
        res.headers.forEach((val, key) => {
          headers[key.toLowerCase()] = val;
        });

        const entry = {
          url: currentUrl,
          status: res.status,
          location: headers['location'] || null,
          headers,
        };
        chain.push(entry);

        console.log(`Hop ${hop + 1}: ${currentUrl}`);
        console.log(`  Status:  ${res.status}`);
        console.log(`  Server:  ${headers['server'] || 'n/a'}`);
        console.log(`  cf-ray:  ${headers['cf-ray'] || 'n/a'}`);
        console.log(`  x-vercel-id: ${headers['x-vercel-id'] || 'n/a'}`);
        console.log(
          `  Location: ${headers['location'] || 'n/a (final response)'}`
        );
        console.log('');

        if (!headers['location']) break; // Final response — no more redirects

        const nextUrl = headers['location'];
        if (!nextUrl.startsWith('http')) {
          // Relative redirect — resolve against current URL
          const base = new URL(currentUrl);
          currentUrl = new URL(nextUrl, base).href;
        } else {
          currentUrl = nextUrl;
        }
      } catch (err: any) {
        console.log(`  Error at hop ${hop + 1}: ${err.message}`);
        break;
      }
    }

    console.log(`\nChain complete: ${chain.length} hops captured`);

    // Print summary
    const redirectCount = chain.filter((c) => c.location).length;
    console.log(`Redirect hops: ${redirectCount}`);

    // Verify loop
    const wwwHops = chain.filter((c) => c.url.includes('www.conferly.site')).length;
    const apexHops = chain.filter((c) => c.url.includes('conferly.site/') && !c.url.includes('www.')).length;
    console.log(`www hops:   ${wwwHops}`);
    console.log(`apex hops:  ${apexHops}`);

    if (wwwHops > 2 && apexHops > 2) {
      console.log('🔴 CONFIRMED: Infinite loop between www and apex domain');
    }

    expect(chain.length).toBeGreaterThan(0);
  });
});