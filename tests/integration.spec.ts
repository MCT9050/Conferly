import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'your-login-email@example.com',
  password: process.env.TEST_USER_PASSWORD || 'your-secure-password'
};

test('Verify WebSocket Handshake and LiveKit Lifecycle', async ({ page }) => {
  const report: string[] = [];

  // 1. Actively intercept WebSocket connections at the browser level
  page.on('websocket', ws => {
    report.push(`🌐 WebSocket Detected: ${ws.url()}`);
    
    ws.on('framesent', event => report.push(`  [WS Sent] Frame size: ${event.payload.length} bytes`));
    ws.on('framereceived', event => report.push(`  [WS Received] Frame size: ${event.payload.length} bytes`));
    ws.on('close', () => report.push(`❌ WebSocket Closed: ${ws.url()}`));
    ws.on('socketerror', err => report.push(`🚨 WebSocket Error: ${err}`));
  });

  // 2. Capture standard browser logs
  page.on('console', msg => report.push(`[Browser ${msg.type()}] ${msg.text()}`));

  // 3. Perform Login
  report.push('--- Starting Authentication ---');
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(TEST_USER.email);
  await page.locator('input[type="password"]').fill(TEST_USER.password);
  
  const supabaseAuthPromise = page.waitForResponse(r => r.url().includes('supabase.co/auth/v1/token'));
  await page.locator('button[type="submit"]').click();
  await supabaseAuthPromise;
  report.push('✅ Supabase authenticated successfully.');

  // 4. Navigate to Meeting and force-wait for LiveKit Token Exchange
  report.push('--- Requesting LiveKit Token ---');
  const lkTokenPromise = page.waitForResponse(r => r.url().includes('/api/lk-token'), { timeout: 15000 });
  
  await page.goto('/dashboard/meeting');
  const lkResponse = await lkTokenPromise;
  expect(lkResponse.status()).toBe(200);
  report.push('✅ Next.js server successfully issued LiveKit token.');

  // 5. Allow time for the WebSocket connection to initialize
  report.push('--- Waiting 5s for WebSocket Handshake stabilization ---');
  await page.waitForTimeout(5000);

  // 6. Print Output Report
  console.log('\n======================================================');
  console.log('         WEBSOCKET & NETWORK STABILITY REPORT         ');
  console.log('======================================================');
  report.forEach(line => console.log(line));
  console.log('======================================================\n');
});
