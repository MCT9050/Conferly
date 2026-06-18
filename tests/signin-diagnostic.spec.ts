import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'nathi.ylt@gmail.com';
const TEST_PASSWORD = 'Nashel@1';

/**
 * Focused diagnostic: captures the exact error from the sign-in API response.
 */
test.describe('Sign-In Error Diagnostic', () => {
  test('capture exact sign-in error response from production API', async ({ page }) => {
    // Intercept the API call to capture raw response
    let apiResponseBody: string | null = null;
    let apiStatus: number | null = null;

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/auth/signin')) {
        apiStatus = response.status();
        try {
          apiResponseBody = await response.text();
        } catch {
          apiResponseBody = '<unreadable>';
        }
        console.log(`\n=== AUTH API RESPONSE ===`);
        console.log(`Status: ${apiStatus}`);
        console.log(`Body: ${apiResponseBody}`);
        console.log(`========================\n`);
      }
    });

    // Navigate to auth page
    await page.goto('https://conferly.site/auth', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify Sign In tab is active (default)
    const signInTab = page.locator('button', { hasText: 'Sign In' });
    await expect(signInTab.first()).toBeVisible({ timeout: 5000 });

    // Fill credentials
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);

    await page.screenshot({ path: 'test-results/signin-diagnostic-filled.png', fullPage: true });

    // Submit
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();

    // Wait for API response and possible redirect
    await page.waitForTimeout(5000);

    // Screenshot the result
    await page.screenshot({ path: 'test-results/signin-diagnostic-result.png', fullPage: true });

    const currentUrl = page.url();
    console.log(`\nFinal URL: ${currentUrl}`);

    // If still on auth page, capture error text
    if (currentUrl.includes('/auth')) {
      // Try different possible error containers
      const errorSelectors = [
        '[class*="text-red"]',
        '[class*="bg-red"]',
        '[role="alert"]',
        '.error',
        '#error',
      ];

      for (const selector of errorSelectors) {
        const el = page.locator(selector);
        if (await el.isVisible().catch(() => false)) {
          const text = await el.textContent();
          console.log(`Error element (${selector}): "${text}"`);
        }
      }

      // Also dump full page text to find any error message
      const pageText = await page.textContent('body');
      const errorMatch = pageText?.match(/(?:error|Error|incorrect|Invalid)[^.]*\./g);
      if (errorMatch) {
        console.log(`Error phrases found: ${JSON.stringify(errorMatch)}`);
      }
    }

    // Print diagnostic
    console.log(`\n=== DIAGNOSTIC SUMMARY ===`);
    console.log(`API status: ${apiStatus}`);
    console.log(`API body: ${apiResponseBody}`);
    console.log(`Final URL: ${currentUrl}`);
    console.log(`==========================\n`);
  });
});