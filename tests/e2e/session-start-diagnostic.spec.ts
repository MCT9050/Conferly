import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Session Start Diagnostic', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'https://conferly.site');
  });

  test('DIAG-01: New Meeting button click - full flow with debugging', async ({ page }) => {
    const logs: string[] = [];
    const consoleErrors: string[] = [];
    
    // Capture console logs
    page.on('console', msg => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture network requests
    const requests: string[] = [];
    page.on('request', request => {
      requests.push(request.url());
    });

    // Navigate to meet dashboard
    await page.goto('https://conferly.site/meet/dashboard');
    await page.waitForTimeout(3000);
    
    console.log('[DIAG-01] Initial URL:', page.url());
    expect(page.url()).toContain('/meet/dashboard');

    // Find and analyze the New Meeting button
    const newMeetingBtn = page.locator(
      'button:has-text("New Meeting"), button:has-text("Start Meeting"), [data-testid="new-meeting-btn"]'
    ).first();
    
    // Wait for button to be ready
    await expect(newMeetingBtn).toBeVisible({ timeout: 10000 });
    await expect(newMeetingBtn).toBeEnabled();
    
    // Log button details
    const btnInfo = await newMeetingBtn.evaluate(el => ({
      tag: el.tagName,
      text: el.textContent?.trim(),
      href: el.getAttribute('href'),
      onClick: el.onclick ? 'present' : 'none',
      disabled: el.hasAttribute('disabled')
    }));
    console.log('[DIAG-01] Button info:', JSON.stringify(btnInfo));

    // Clear previous logs
    logs.length = 0;
    requests.length = 0;

    // Click the button
    console.log('[DIAG-01] Clicking New Meeting button...');
    await newMeetingBtn.click();
    
    // Wait and monitor navigation
    await page.waitForTimeout(5000);
    
    const finalUrl = page.url();
    console.log('[DIAG-01] Final URL:', finalUrl);
    console.log('[DIAG-01] Console logs:', logs.join('\n'));
    console.log('[DIAG-01] Console errors:', consoleErrors.join('\n'));
    
    // Take screenshot for visual debugging
    await page.screenshot({ path: 'tests/e2e/screenshots/diag-01-after-click.png', fullPage: true });

    // Check if we're still on dashboard (the bug)
    if (finalUrl.includes('/dashboard')) {
      console.error('[DIAG-01] BUG CONFIRMED: Redirected back to dashboard after clicking New Meeting');
    }

    // Check if we're in lobby or room
    expect(finalUrl).toMatch(/\/(lobby|meet\/rooms\/)/);
  });

  test('DIAG-02: Direct lobby access with room parameter', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Try direct lobby access
    const roomId = 'test-diag-room-' + Date.now();
    await page.goto(`https://conferly.site/lobby?room=${roomId}`);
    await page.waitForTimeout(5000);
    
    console.log('[DIAG-02] Lobby URL:', page.url());
    console.log('[DIAG-02] Console errors:', consoleErrors.join('\n'));
    
    await page.screenshot({ path: 'tests/e2e/screenshots/diag-02-lobby.png', fullPage: true });

    // Should be in lobby, not redirected to dashboard
    expect(page.url()).toContain('/lobby');
    expect(page.url()).not.toContain('/dashboard');
  });

  test('DIAG-03: Monitor navigation events during session start', async ({ page }) => {
    const navigationEvents: string[] = [];
    
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigationEvents.push(frame.url());
        console.log('[DIAG-03] Navigation:', frame.url());
      }
    });

    await page.goto('https://conferly.site/meet/dashboard');
    await page.waitForTimeout(2000);

    // Click New Meeting
    const newMeetingBtn = page.locator('button:has-text("New Meeting"), button:has-text("Start Meeting")').first();
    await expect(newMeetingBtn).toBeVisible({ timeout: 10000 });
    await newMeetingBtn.click();
    
    await page.waitForTimeout(5000);
    
    console.log('[DIAG-03] All navigation events:', navigationEvents.join('\n'));
    console.log('[DIAG-03] Final URL:', page.url());
    
    await page.screenshot({ path: 'tests/e2e/screenshots/diag-03-nav-flow.png', fullPage: true });

    // Verify expected navigation sequence
    expect(navigationEvents.length).toBeGreaterThan(0);
    const lastUrl = navigationEvents[navigationEvents.length - 1];
    expect(lastUrl).toMatch(/\/(lobby|meet\/rooms\/)/);
  });

  test('DIAG-04: Check for auth/session issues', async ({ page }) => {
    const authErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        authErrors.push(msg.text());
      }
    });

    await page.goto('https://conferly.site/meet/dashboard');
    await page.waitForTimeout(2000);

    // Check if user is still authenticated
    const hasUserIndicator = await page.locator('[data-testid="user-menu"], button:has-text("Sign out"), img[alt*="avatar"], .user-avatar').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log('[DIAG-04] User menu/avatar visible:', hasUserIndicator);
    
    // Try to access a protected API endpoint
    const apiResponse = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/test');
        return { status: res.status, ok: res.ok };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    });
    console.log('[DIAG-04] Auth API test:', JSON.stringify(apiResponse));

    await page.screenshot({ path: 'tests/e2e/screenshots/diag-04-auth-state.png', fullPage: true });
  });
});