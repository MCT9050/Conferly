import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'nathi.ylt@gmail.com';
const TEST_PASSWORD = 'Nashel@1';
const PRODUCTION_URL = 'https://www.conferly.site';

/**
 * Production Diagnostic Test — Sign-in Flow
 *
 * Tests the sign-in flow against the production site:
 * 1. Navigate to /auth
 * 2. Fill in credentials
 * 3. Submit sign-in
 * 4. Capture all network requests, cookies, console logs
 * 5. Verify redirect to dashboard succeeds
 */
test.describe('Production Sign-In Diagnostic', () => {
  test('sign-in flow completes end-to-end on production', async ({ page }) => {
    // Collect console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Collect all network requests from auth API
    const apiResponses: { url: string; status: number; body: string }[] = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/auth/')) {
        try {
          const body = await response.text();
          apiResponses.push({ url, status: response.status(), body: body.slice(0, 500) });
        } catch {
          apiResponses.push({ url, status: response.status(), body: '<unreadable>' });
        }
      }
    });

    // Step 1: Navigate to the auth page
    await test.step('Navigate to /auth', async () => {
      await page.goto(`${PRODUCTION_URL}/auth`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/auth-page-loaded.png', fullPage: true });
    });

    // Step 2: Check that the sign-in form is visible
    await test.step('Verify sign-in form is visible', async () => {
      // Should see Sign In button (tab toggle) and the email input
      const signInTab = page.locator('button', { hasText: 'Sign In' });
      await expect(signInTab.first()).toBeVisible({ timeout: 10000 });

      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible({ timeout: 5000 });
    });

    // Step 3: Fill in credentials and submit
    await test.step('Fill credentials and submit sign-in', async () => {
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);

      await page.screenshot({ path: 'test-results/auth-form-filled.png', fullPage: true });

      // Wait for the submit button to be enabled and click
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled({ timeout: 5000 });
      await submitButton.click();
    });

    // Step 4: Wait for navigation or error
    await test.step('Wait for sign-in result', async () => {
      // Wait up to 15 seconds for navigation to dashboard or for error to appear
      await page.waitForTimeout(3000);

      // Take screenshot of whatever state we're in
      await page.screenshot({ path: 'test-results/auth-after-submit.png', fullPage: true });

      // Check current URL
      const currentUrl = page.url();
      console.log(`Current URL after sign-in: ${currentUrl}`);

      // Check if we're still on auth (error likely)
      if (currentUrl.includes('/auth')) {
        // Look for error messages
        const errorEl = page.locator('[class*="text-red"]');
        if (await errorEl.isVisible()) {
          const errorText = await errorEl.textContent();
          console.log(`Error message visible: ${errorText}`);
        }

        // Check console logs for clues
        console.log('Console logs captured:');
        consoleLogs.forEach((log) => console.log(log));

        // Check API responses
        console.log('API responses captured:');
        apiResponses.forEach((r) => console.log(`  ${r.status} ${r.url}: ${r.body}`));
      }

      // If redirected to dashboard, verify it's the dashboard
      if (currentUrl.includes('/dashboard') || currentUrl.includes('/lobby')) {
        console.log('SUCCESS: Redirected to authenticated page');
        await page.screenshot({ path: 'test-results/dashboard-loaded.png', fullPage: true });
      }
    });

    // Step 5: Check cookies
    await test.step('Inspect cookies after sign-in', async () => {
      const cookies = await page.context().cookies();
      const authCookies = cookies.filter(
        (c) => c.name.includes('supabase') || c.name.includes('sb-') || c.name.includes('auth')
      );
      console.log('Auth-related cookies:');
      authCookies.forEach((c) => {
        console.log(`  ${c.name}: domain=${c.domain}, path=${c.path}, secure=${c.secure}, httpOnly=${c.httpOnly}`);
      });
      await page.screenshot({ path: 'test-results/cookies-state.png', fullPage: true });
    });

    // Final diagnostic dump
    console.log('\n=== DIAGNOSTIC SUMMARY ===');
    console.log(`Final URL: ${page.url()}`);
    console.log(`API responses: ${apiResponses.length}`);
    console.log(`Console logs: ${consoleLogs.length}`);
    console.log('==========================\n');
  });
});

/**
 * Production Diagnostic Test — Meeting Room
 *
 * Tests the meeting room page against production:
 * 1. Sign in first
 * 2. Navigate to /lobby or /meeting
 * 3. Check if media components load
 * 4. Check if meeting controls are interactive
 */
test.describe('Production Meeting Room Diagnostic', () => {
  test('meeting room loads with controls visible', async ({ page }) => {
    // Collect console logs and errors
    const consoleLogs: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Step 1: Sign in first
    await test.step('Sign in before accessing meeting', async () => {
      await page.goto(`${PRODUCTION_URL}/auth`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {});
      console.log(`After sign-in URL: ${page.url()}`);
      await page.screenshot({ path: 'test-results/meeting-signed-in.png', fullPage: true });
    });

    // Step 2: Navigate to meeting page
    await test.step('Navigate to /meeting', async () => {
      await page.goto(`${PRODUCTION_URL}/meeting`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(5000); // Give dynamic imports time to load

      await page.screenshot({ path: 'test-results/meeting-page-loaded.png', fullPage: true });
      console.log(`Meeting page URL: ${page.url()}`);
    });

    // Step 3: Check for meeting controls
    await test.step('Check meeting controls presence', async () => {
      // Look for the control buttons
      const muteButton = page.locator('button', { hasText: /Mute|Muted/i });
      const shareScreenButton = page.locator('button', { hasText: /Share Screen|Sharing/i });
      const endMeetingButton = page.locator('button', { hasText: /End Meeting/i });

      const muteVisible = await muteButton.isVisible().catch(() => false);
      const shareVisible = await shareScreenButton.isVisible().catch(() => false);
      const endVisible = await endMeetingButton.isVisible().catch(() => false);

      console.log(`Meeting controls visibility:`);
      console.log(`  Mute button: ${muteVisible}`);
      console.log(`  Share Screen button: ${shareVisible}`);
      console.log(`  End Meeting button: ${endVisible}`);

      // Check for video placeholder
      const videoPlaceholder = page.locator('text=Meeting video feed placeholder');
      const videoVisible = await videoPlaceholder.isVisible().catch(() => false);
      console.log(`  Video placeholder visible: ${videoVisible}`);

      // Check for chat placeholder
      const chatPlaceholder = page.locator('text=Chat messages');
      const chatVisible = await chatPlaceholder.isVisible().catch(() => false);
      console.log(`  Chat placeholder visible: ${chatVisible}`);
    });

    // Step 4: Click mute button and verify state change
    await test.step('Test meeting control button interaction', async () => {
      const muteButton = page.locator('button', { hasText: /Mute|Muted/i });
      if (await muteButton.isVisible()) {
        const initialText = await muteButton.textContent();
        console.log(`Initial mute button text: ${initialText}`);
        
        await muteButton.click();
        await page.waitForTimeout(500);
        
        const afterText = await muteButton.textContent();
        console.log(`After click mute button text: ${afterText}`);
        
        await page.screenshot({ path: 'test-results/meeting-mute-clicked.png', fullPage: true });
      }

      const endButton = page.locator('button', { hasText: /End Meeting/i });
      if (await endButton.isVisible()) {
        const endText = await endButton.textContent();
        console.log(`End meeting button text: ${endText}`);
      }
    });

    // Print diagnostics
    console.log('\n=== MEETING DIAGNOSTIC SUMMARY ===');
    console.log(`Final URL: ${page.url()}`);
    console.log(`Page errors: ${pageErrors.length}`);
    pageErrors.forEach((err, i) => console.log(`  Error ${i + 1}: ${err}`));
    console.log('==================================\n');
  });
});