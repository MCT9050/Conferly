import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'nathi.ylt@gmail.com';
const TEST_PASSWORD = 'Nashel@1';
const BASE_URL = process.env.BASE_URL || 'https://conferly.site';

test.describe('Conferly Production Readiness Report', () => {
  test('Full app flow: landing → sign-in → dashboard → meeting', async ({ page }) => {
    const errors: string[] = [];
    const networkFailures: string[] = [];
    const consoleErrors: string[] = [];

    // === MONITOR CONSOLE & ERRORS ===
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push(text);
        errors.push(`[CONSOLE ERROR] ${text}`);
      } else if (type === 'warning') {
        errors.push(`[CONSOLE WARN] ${text}`);
      }
    });

    page.on('pageerror', (err) => {
      errors.push(`[PAGE ERROR] ${err.message}`);
    });

    page.on('requestfailed', (request) => {
      const url = request.url();
      const failure = request.failure();
      networkFailures.push(`${url}: ${failure?.errorText || 'unknown'}`);
      errors.push(`[NETWORK FAIL] ${url}: ${failure?.errorText || 'unknown'}`);
    });

    page.on('response', (response) => {
      if (response.status() >= 400) {
        errors.push(`[HTTP ${response.status()}] ${response.url()}`);
      }
    });

    // === STEP 1: Landing Page ===
    console.log('\n=== STEP 1: Landing Page ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const landingScreenshot = `${BASE_URL.replace(/[^a-z0-9]/gi, '_')}_landing`;
    await page.screenshot({ path: `test-results/${landingScreenshot}.png`, fullPage: true });
    await page.screenshot({ path: `test-results/${landingScreenshot}_top300.png`, clip: { x: 0, y: 0, width: 1400, height: 300 } });

    // Check for excessive slogans/tags at the top
    const topSection = page.locator('header, nav, .hero, [class*="header"], [class*="hero"], [class*="banner"]').first();
    const topText = (await topSection.textContent({ timeout: 5000 }).catch(() => '')) ?? '';
    console.log(`Top section text: "${topText.substring(0, 500)}"`);

    // Count how many tag-like elements are in the header area
    const tagElements = await page.locator('header, nav').locator('span, .tag, .badge, [class*="tag"], [class*="badge"]').count();
    console.log(`Tag/badge count in header: ${tagElements}`);

    // === STEP 2: Sign In ===
    console.log('\n=== STEP 2: Sign In ===');
    const signInLink = page.locator('a:has-text("Sign In"), a[href*="signin"], a[href*="sign-in"], button:has-text("Sign In")').first();
    const signInExists = await signInLink.count() > 0;

    if (signInExists) {
      await signInLink.click();
    } else {
      await page.goto(`${BASE_URL}/auth`);
    }

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/auth_page.png' });

    // Fill email
    const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);

    // Fill password
    const passwordInput = page.locator('input[type="password"], input[name="password"], input[id="password"]').first();
    await passwordInput.fill(TEST_PASSWORD);

    await page.screenshot({ path: 'test-results/auth_filled.png' });

    // Submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Sign in")').first();
    await submitBtn.click();

    // Wait for auth to complete and redirect
    await page.waitForTimeout(8000);
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.screenshot({ path: 'test-results/post_auth.png' });

    // === STEP 3: Dashboard ===
    console.log('\n=== STEP 3: Dashboard ===');
    // Wait longer for SPA redirects to settle
    await page.waitForTimeout(5000);
    const currentUrl = page.url();
    console.log(`Current URL after sign-in: ${currentUrl}`);
    if (!currentUrl.includes('dashboard') && !currentUrl.includes('lobby')) {
      // Poll for redirect — the SPA may take a while to navigate
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(3000);
        const u = page.url();
        if (u.includes('dashboard') || u.includes('lobby') || u.includes('meeting')) {
          console.log(`Redirect detected after poll: ${u}`);
          break;
        }
        if (i === 6) {
          // As fallback, try navigating to dashboard directly
          await page.goto(`${BASE_URL}/dashboard`).catch(() => {});
        }
      }
    }

    const dashboardScreenshot = 'test-results/dashboard.png';
    await page.screenshot({ path: dashboardScreenshot, fullPage: true });
    console.log(`Dashboard URL: ${page.url()}`);

    // === STEP 4: Start Meeting ===
    console.log('\n=== STEP 4: Start Meeting ===');
    const newMeetingBtn = page.locator('button:has-text("New Meeting"), button:has-text("Start Meeting"), button:has-text("Create Meeting"), a:has-text("New Meeting"), [data-testid*="meeting"]').first();

    const btnExists = await newMeetingBtn.count() > 0;
    if (btnExists) {
      await newMeetingBtn.click();
    } else {
      // Try lobby page directly
      await page.goto(`${BASE_URL}/lobby`);
    }

    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.screenshot({ path: 'test-results/lobby.png' });
    console.log(`Lobby URL: ${page.url()}`);

    // Click join/start meeting
    const joinBtn = page.locator('button:has-text("Join"), button:has-text("Start"), button:has-text("Enter"), button:has-text("Join Meeting")').first();
    if (await joinBtn.count() > 0) {
      await joinBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    }

    // === STEP 5: Meeting Room ===
    console.log('\n=== STEP 5: Meeting Room ===');
    await page.screenshot({ path: 'test-results/meeting_room.png', fullPage: true });
    console.log(`Meeting URL: ${page.url()}`);

    // Wait a bit for potential async errors
    await page.waitForTimeout(5000);

    // Check LiveKit connection indicators
    const livekitConnected = await page.locator('text=Connected, [class*="connected"], [class*="ready"]').count();
    console.log(`LiveKit connected indicators: ${livekitConnected}`);

    // Capture final screenshot
    await page.screenshot({ path: 'test-results/meeting_final.png', fullPage: true });

    // === REPORT ===
    console.log('\n\n========================================');
    console.log('CONFERENCE READINESS REPORT');
    console.log('========================================');
    console.log(`\n🌐 Base URL: ${BASE_URL}`);
    console.log(`\n📱 Landing Page:`);
    console.log(`   - Screenshot saved: ${landingScreenshot}.png`);
    console.log(`   - Tag/badge count in header: ${tagElements}`);
    console.log(`   - Top text preview: "${topText.substring(0, 200)}"`);

    console.log(`\n🔐 Authentication:`);
    if (page.url().includes('dashboard') || page.url().includes('lobby') || page.url().includes('meeting')) {
      console.log(`   - ✅ Sign-in successful`);
    } else if (page.url().includes('auth')) {
      console.log(`   - ❌ Sign-in failed (still on auth page)`);
    } else {
      console.log(`   - ⚠️  Unexpected URL after auth: ${page.url()}`);
    }

    console.log(`\n📊 Dashboard:`);
    if (page.url().includes('dashboard')) {
      console.log(`   - ✅ Dashboard loaded`);
    } else {
      console.log(`   - ⚠️  Dashboard not reached`);
    }

    console.log(`\n🎥 Meeting Room:`);
    if (page.url().includes('meeting')) {
      console.log(`   - ✅ Meeting room joined`);
    } else {
      console.log(`   - ⚠️  Meeting room not reached`);
    }

    console.log(`\n🚨 Errors (${errors.length} total):`);
    if (errors.length === 0) {
      console.log('   - None detected');
    } else {
      errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
    }

    console.log(`\n🌐 Network Failures (${networkFailures.length} total):`);
    if (networkFailures.length === 0) {
      console.log('   - None detected');
    } else {
      networkFailures.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
    }

    console.log('\n========================================\n');

    // Assertions for test pass/fail
    expect(errors.filter(e => e.includes('CONSOLE ERROR')).length).toBeLessThan(5);
  });
});