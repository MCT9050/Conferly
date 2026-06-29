import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://conferly.site';

test.describe('Landing Page Audit: Branding & Layout', () => {
  test('Audit landing page crowding, slogans, and visual hierarchy', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[CONSOLE ERROR] ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`[PAGE ERROR] ${err.message}`));

    // === NAVIGATE ===
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/landing_audit_full.png', fullPage: true });
    await page.screenshot({ path: 'test-results/landing_audit_top300.png', clip: { x: 0, y: 0, width: 1440, height: 300 } });

    // === HEADER / NAV ANALYSIS ===
    const header = page.locator('header, nav').first();
    const headerExists = await header.count() > 0;
    console.log(`Header element exists: ${headerExists}`);

    let headerBadges = 0;
    if (headerExists) {
      const headerText: string = (await header.textContent()) ?? '';
      console.log(`Header text length: ${headerText.length}`);
      console.log(`Header text preview: "${headerText.substring(0, 300)}"`);

      // Count badge/tag/label elements in header
      headerBadges = await header.locator('span, .badge, .tag, .label, [class*="badge"], [class*="tag"], [class*="label"], small, .text-xs, .text-sm').count();
      console.log(`Badge/tag/small elements in header: ${headerBadges}`);
    }

    // === TOP 300PX BRANDING SECTION ===
    const topSection = page.locator('header, nav, .hero, .top-bar, [class*="header"], [class*="announcement"], [class*="banner"]').first();
    const topSectionExists = await topSection.count() > 0;
    console.log(`Top branding section exists: ${topSectionExists}`);

    if (topSectionExists) {
      const topBoundingBox = await topSection.boundingBox();
      console.log(`Top section height: ${topBoundingBox?.height ?? 'unknown'}px`);
    }

    // Count ALL visible text nodes in the top 300px using JavaScript
    const topTextInfo = await page.evaluate(() => {
      const results: { count: number; totalLength: number; sample: string[] } = { count: 0, totalLength: 0, sample: [] };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const rect = node.parentElement?.getBoundingClientRect();
        if (rect && rect.top < 300 && rect.top >= 0 && rect.width > 0) {
          const text = node.textContent?.trim();
          if (text && text.length > 2) {
            results.count++;
            results.totalLength += text.length;
            if (results.sample.length < 10) results.sample.push(text.substring(0, 80));
          }
        }
      }
      return results;
    });
    console.log(`Text nodes in top 300px: count=${topTextInfo.count}, total chars=${topTextInfo.totalLength}`);
    console.log(`Sample text nodes: ${JSON.stringify(topTextInfo.sample)}`);

    // === HERO / MAIN VISUAL ANALYSIS ===
    const heroSection = page.locator('.hero, [class*="hero"], section:first-of-type, main > section:first-child').first();
    if (await heroSection.count() > 0) {
      const heroText: string = (await heroSection.textContent()) ?? '';
      console.log(`Hero text length: ${heroText.length}`);
      console.log(`Hero text preview: "${heroText.substring(0, 400)}"`);
    }

    // Count headlines (h1, h2) on the page
    const h1Count = await page.locator('h1').count();
    const h2Count = await page.locator('h2').count();
    console.log(`H1 count: ${h1Count}, H2 count: ${h2Count}`);

    // === UI DENSITY METRICS ===
    const densityMetrics = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const visibleElements = Array.from(allElements).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });

      // Count buttons
      const buttons = document.querySelectorAll('button, a[class*="btn"], [role="button"]').length;

      // Count text-heavy elements
      const textBlocks = document.querySelectorAll('p, span, div').length;

      // Measure viewport
      const vpWidth = window.innerWidth;
      const vpHeight = window.innerHeight;

      return {
        totalElements: visibleElements.length,
        buttons,
        textBlocks,
        viewportWidth: vpWidth,
        viewportHeight: vpHeight,
      };
    });
    console.log(`Density metrics: ${JSON.stringify(densityMetrics)}`);

    // === OVERFLOW / LAYOUT SHIFT CHECK ===
    const overflowElements = await page.evaluate(() => {
      const overflows: string[] = [];
      document.querySelectorAll('*').forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.scrollWidth > htmlEl.clientWidth + 5) {
          overflows.push(htmlEl.tagName + '.' + (htmlEl.className || '').toString().substring(0, 60));
        }
      });
      return overflows.slice(0, 20);
    });
    console.log(`Horizontal overflow elements (max 20): ${JSON.stringify(overflowElements)}`);

    // === BRANDING ELEMENTS ===
    // The logo may now be an inline SVG without "logo" in its class — detect by namespace or text
    const logoElement = page.locator('svg[viewBox="0 0 40 40"], [class*="logo"], img[class*="logo"]').first();
    const logoExists = await logoElement.count() > 0;
    console.log(`Logo element found: ${logoExists}`);

    const taglineElements = await page.locator('[class*="tagline"], [class*="slogan"], h1, .headline').count();
    console.log(`Tagline/headline elements: ${taglineElements}`);

    // === SCREENSHOTS AT DIFFERENT VIEWPORTS ===
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/landing_mobile.png', fullPage: true });

    // === FINAL REPORT ===
    console.log('\n\n========================================');
    console.log('LANDING PAGE AUDIT REPORT');
    console.log('========================================');
    console.log(`\n📐 Viewport: ${densityMetrics.viewportWidth}x${densityMetrics.viewportHeight}`);
    console.log(`\n🔤 Typography: h1=${h1Count}, h2=${h2Count}`);
    console.log(`\n📊 Density:`);
    console.log(`   - Total visible elements: ${densityMetrics.totalElements}`);
    console.log(`   - Buttons: ${densityMetrics.buttons}`);
    console.log(`   - Text blocks: ${densityMetrics.textBlocks}`);
    console.log(`\n🏷️  Header Analysis:`);
    console.log(`   - Badge/tag/small elements in header: ${headerExists ? headerBadges : 'N/A'}`);
    console.log(`   - Text nodes in top 300px: ${topTextInfo.count}`);
    console.log(`\n⚠️  Crowding Indicators:`);
    console.log(`   - High text density in top area: ${topTextInfo.count > 15 ? 'YES ⚠️' : 'NO ✓'}`);
    console.log(`   - Horizontal overflow elements: ${overflowElements.length}`);
    console.log(`   - Logo present: ${logoExists ? 'YES ✓' : 'NO ⚠️'}`);
    console.log(`\n📸 Screenshots saved:`);
    console.log(`   - landing_audit_full.png`);
    console.log(`   - landing_audit_top300.png`);
    console.log(`   - landing_mobile.png`);
    console.log(`\n🚨 Errors: ${errors.length}`);
    errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
    console.log('========================================\n');

    expect(errors.filter(e => e.includes('CONSOLE ERROR')).length).toBeLessThan(5);
  });
});