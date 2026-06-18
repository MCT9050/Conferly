import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'nathi.ylt@gmail.com';
const TEST_PASSWORD = 'Nashel@1';

/**
 * Captures the exact React error from the meeting room to diagnose infinite loop (#310).
 */
test.describe('Meeting Room Error Diagnostic', () => {
  test('capture React error #310 and page state', async ({ page }) => {
    // Capture all console errors with full stack traces
    const consoleErrors: string[] = [];
    const pageJsErrors: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageJsErrors.push(`${err.message}\n${err.stack || ''}`);
    });

    page.on('response', (response) => {
      if (!response.ok() && response.url().includes('conferly.site')) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    // Step 1: Sign in first
    await test.step('Sign in', async () => {
      await page.goto('https://conferly.site/auth', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {});
      await page.screenshot({ path: 'test-results/meeting-error-diagnostic-signed-in.png', fullPage: true });
      console.log(`Signed in, current URL: ${page.url()}`);
    });

    // Step 2: Navigate to meeting
    await test.step('Navigate to meeting room', async () => {
      // First navigate to lobby to see if that works
      await page.goto('https://conferly.site/meeting', { waitUntil: 'domcontentloaded' });
      
      // Wait for the page to settle — the error should fire within seconds
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'test-results/meeting-error-state.png', fullPage: true });
      console.log(`Meeting page URL: ${page.url()}`);
      console.log(`\n=== PAGE TEXT CONTENT ===`);
      const text = await page.textContent('body');
      console.log(text?.substring(0, 3000));
      console.log(`\n========================`);
    });

    // Step 3: Check for error boundary/error fallback
    await test.step('Capture error boundary content', async () => {
      // Look for error-related elements
      const errorElements = await page.locator('[class*="error"], [class*="Error"], [class*="fallback"], [class*="Fallback"]').all();
      console.log(`\nError-related elements found: ${errorElements.length}`);
      for (const el of errorElements) {
        const text = await el.textContent();
        const tag = await el.evaluate(e => e.tagName);
        console.log(`  <${tag}>: ${text?.substring(0, 200)}`);
      }

      // Look for any button that says "retry", "try again", "refresh", "reset"
      const actionButtons = await page.locator('button:has-text("try"), button:has-text("Try"), button:has-text("retry"), button:has-text("Retry"), button:has-text("refresh"), button:has-text("Reset")').all();
      console.log(`Action buttons found: ${actionButtons.length}`);
      for (const btn of actionButtons) {
        const text = await btn.textContent();
        console.log(`  Button: "${text}"`);
      }
    });

    // Step 4: Try clicking "Try again" or reset button if present
    await test.step('Try error recovery', async () => {
      const resetBtn = page.locator('button:has-text("Try again"), button:has-text("Reset"), button:has-text("Retry"), button:has-text("Refresh")').first();
      if (await resetBtn.isVisible().catch(() => false)) {
        console.log('Clicking reset button...');
        await resetBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/meeting-after-retry.png', fullPage: true });
        const afterText = await page.textContent('body');
        console.log(`After retry: ${afterText?.substring(0, 1000)}`);
      }
    });

    // Print full diagnostics
    console.log(`\n========== FULL DIAGNOSTIC REPORT ==========`);
    console.log(`Final URL: ${page.url()}`);
    console.log(`\n--- Page JS Errors (${pageJsErrors.length}) ---`);
    pageJsErrors.forEach((e, i) => console.log(`[${i + 1}] ${e.substring(0, 500)}`));
    console.log(`\n--- Console Errors (${consoleErrors.length}) ---`);
    consoleErrors.forEach((e, i) => console.log(`[${i + 1}] ${e.substring(0, 500)}`));
    console.log(`\n--- Network Errors (${networkErrors.length}) ---`);
    networkErrors.forEach((e) => console.log(`  ${e}`));
    console.log(`\n============================================`);
  });
});