import { test, expect } from '@playwright/test';

test('Diagnose Conferly Auth Blocking', async ({ page }) => {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  const consoleLogs: string[] = [];

  // 0. Capture all console logs for debugging
  page.on('console', (msg) => {
    const text = `[${msg.type().toUpperCase()}]: ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  // 1. Catch crash / unhandled exceptions with full stack trace
  page.on('pageerror', (exception) => {
    console.error('\n🚨 CRITICAL RUNTIME EXCEPTION DETECTED:');
    console.error(`Message: ${exception.message}`);
    console.error(`Stack Trace:\n${exception.stack}`); // This exposes the exact Vite bundle line
    consoleErrors.push(`[Unhandled Exception]: ${exception.message}`);
    consoleErrors.push(`[Stack]: ${exception.stack}`);
  });

  // 2. Monitor Supabase & Livekit endpoint communication
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    // Check for auth-related API calls
    if (url.includes('supabase') || url.includes('livekit') || url.includes('auth')) {
      if (status >= 400) {
        networkErrors.push(`[Network Error] ${status} - URL: ${url}`);
      } else if (status >= 200 && status < 300) {
        consoleLogs.push(`[Network Success] ${status} - URL: ${url}`);
      }
    }
  });

  // Navigate to auth page using relative path (adapts to staging or production)
  console.log('Navigating to auth page...');
  await page.goto('/#/auth');
  await page.waitForTimeout(2000);
  
  // Get page title/content for debugging
  const title = await page.title();
  console.log('Page title:', title);
  
  // Check what's on the page
  const bodyContent = await page.locator('body').innerText().catch(() => 'N/A');
  console.log('Page content preview:', bodyContent.substring(0, 500));

  // 3. Look for Sign In or Sign Up button to verify auth form is loaded
  const signInBtn = page.locator('button:has-text("Sign In")').first();
  const signUpBtn = page.locator('button:has-text("Sign Up")').first();
  
  const hasAuthForm = await signInBtn.isVisible().catch(() => false) || await signUpBtn.isVisible().catch(() => false);
  
  if (!hasAuthForm) {
    console.log('⚠️ Auth form not visible - checking for alternative auth triggers...');
    // Try clicking "Get Started" if it exists
    const getStarted = page.locator('text=/get started/i').first();
    if (await getStarted.isVisible().catch(() => false)) {
      console.log('Found Get Started button, clicking...');
      await getStarted.click();
      await page.waitForTimeout(2000);
    }
  }

  // 4. Fill credentials to test form submission event dispatching
  const emailInput = page.locator('input[type="email"], input[name="email"], input#email').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"], input#password').first();
  
  if (await emailInput.isVisible().catch(() => false)) {
    console.log('Filling test credentials...');
    await emailInput.fill('agent-test@conferly.site');
    await passwordInput.fill('SecurePass123!');
  } else {
    consoleErrors.push('❌ Email input field not found on page');
  }

  // Locating the authentication Login / Sign Up buttons
  const authButton = page.locator('button:has-text("Sign In"), button:has-text("Sign Up"), button[type="submit"]').first();
  const isAuthButtonVisible = await authButton.isVisible().catch(() => false);
  
  if (!isAuthButtonVisible) {
    consoleErrors.push('❌ Auth button not found on page');
  } else {
    console.log('Clicking the authentication button...');
    // Force click skips Playwright's actionability checks to see if the DOM element is dead
    await authButton.click({ force: true }); 

    // Give the browser 3 seconds to process any failing state or async promise
    await page.waitForTimeout(3000); 
  }

  // Print diagnostic log
  console.log('\n=== CONFERLY INTERCEPT LOGS ===');
  console.log('--- Console Logs ---');
  console.log(consoleLogs.join('\n'));
  
  if (consoleErrors.length > 0) {
    console.error('❌ Browser Errors Found:\n', consoleErrors.join('\n'));
  }
  if (networkErrors.length > 0) {
    console.error('❌ Network/Cloudflare Failures Found:\n', networkErrors.join('\n'));
  }

  expect(consoleErrors.length + networkErrors.length).toBe(0);
});