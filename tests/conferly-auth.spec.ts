import { test, expect } from '@playwright/test';


test('Force Capture Assets Directory 404 and Hidden Chunk Failures', async ({ page }) => {
  const assetErrors: Array<{ url: string; status: number; type: string }> = [];
  const runtimeLogs: string[] = [];
  const consoleMessages: string[] = [];


  // 0. Capture ALL console messages including error
  page.on('console', (msg) => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type().toUpperCase()}] ${text}`);
    if (msg.type() === 'error') {
      runtimeLogs.push(`[Console Error]: ${text}`);
    }
  });


  // 1. Intercept all responses specifically filtering for the /assets/ directory
  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    
    // Log any asset drop or backend failure immediately
    if (status >= 400 && url.includes('/assets/')) {
      assetErrors.push({
        url,
        status,
        type: response.request().resourceType(),
      });
    }
  });


  // 2. Capture low-level link and resource load crashes
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (request.url().includes('/assets/')) {
      runtimeLogs.push(`[Asset Fetch Failed]: ${request.url()} | Reason: ${failure?.errorText}`);
    }
  });


  // 3. Monitor React 19 dynamic import rejections
  page.on('pageerror', (err) => {
    runtimeLogs.push(`[Unhandled Code Exception]: ${err.message}\nStack: ${err.stack}`);
  });


  // Execute authentication steps against local staging container
  await page.goto('/');
  
  const getStarted = page.locator('text=/get started/i').first();
  await getStarted.click();


  await page.locator('input[type="email"]').fill('diagnostic-agent@conferly.site');
  await page.locator('input[type="password"]').fill('Password123!');


  // Wait for form to fully render
  await page.waitForTimeout(1000);

  const actionButton = page.locator('button:has-text("Log In"), button[type="submit"]').first();
  
  console.log('Triggering auth execution button click event...');
  await actionButton.click();


  // Force a short wait to ensure lazy-loaded asset chunks try to clear the network wire
  await page.waitForTimeout(2000);


  // Print exhaustive Asset Diagnostics Report directly to your container stdout
  console.log('\n==================================================');
  console.log('🚨 EXPLICIT ASSET DIRECTORY DIAGNOSTIC TRAFFIC LOG');
  console.log('==================================================');
  
  if (assetErrors.length > 0) {
    console.error('❌ CRITICAL 404/FETCH ASSET DROPS DETECTED:');
    assetErrors.forEach(err => {
      console.error(`  -> Status: ${err.status} | Type: ${err.type} | URL: ${err.url}`);
    });
  } else {
    console.log('✅ Zero 404 network errors captured inside the /assets/ directory paths.');
  }


  if (runtimeLogs.length > 0) {
    console.error('\n❌ HIDDEN COMPONENT AND SYSTEM CODES STACK:');
    console.error(runtimeLogs.join('\n'));
  }

  // Print all captured console messages
  console.log('\n--- ALL CONSOLE MESSAGES ---');
  consoleMessages.forEach(msg => console.log(msg));

  // STRICTER: Fail if any errors detected
  expect(runtimeLogs.length).toBe(0);
  expect(assetErrors.length).toBe(0);
});
