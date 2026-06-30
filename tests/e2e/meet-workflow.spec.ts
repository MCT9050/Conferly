import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Conferly Meet — Full Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'https://conferly.site');
  });

  test('TC-MEET-01: Dashboard loads with Meet product card', async ({ page }) => {
    await page.goto('https://conferly.site/dashboard');
    
    // Wait for dashboard to load
    await page.waitForTimeout(2000);
    
    // Look for Meet card or Meet dashboard
    const meetCard = page.locator('a:has-text("Meet"), button:has-text("Meet"), [data-testid="meet-card"]').first();
    const meetDashboard = page.locator('text=New Meeting, text=Start Meeting, text=Schedule').first();
    
    // If on product selector, click Meet
    if (await meetCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await meetCard.click();
      await page.waitForURL('**/meet/dashboard**', { timeout: 10000 });
    }
    
    // Verify we're on meet dashboard
    console.log(`[DEBUG] TC-MEET-01 final URL: ${page.url()}`);
    expect(page.url()).toContain('/meet/dashboard');
  });

  test('TC-MEET-02: New Meeting button is clickable', async ({ page }) => {
    await page.goto('https://conferly.site/meet/dashboard');
    await page.waitForTimeout(3000);
    
    // Find the "New Meeting" or "Start Meeting" button
    const newMeetingBtn = page.locator(
      'button:has-text("New Meeting"), button:has-text("Start Meeting"), button:has-text("Start"), a:has-text("New Meeting"), a:has-text("Start Meeting"), [data-testid="new-meeting-btn"]'
    ).first();
    
    // Verify button exists and is visible
    await expect(newMeetingBtn).toBeVisible({ timeout: 10000 });
    
    // Verify button is enabled
    await expect(newMeetingBtn).toBeEnabled();
    
    // Log button attributes for debugging
    const tagName = await newMeetingBtn.evaluate(el => el.tagName);
    const href = await newMeetingBtn.getAttribute('href');
    const onClick = await newMeetingBtn.evaluate(el => el.onclick?.toString() || 'no onclick');
    const className = await newMeetingBtn.getAttribute('class');
    console.log(`[DEBUG] New Meeting button: tag=${tagName}, href=${href}, class=${className}, onclick=${onClick}`);
    
    // Click the button
    await newMeetingBtn.click();
    
    // Wait for navigation or modal
    await page.waitForTimeout(3000);
    
    // Log current URL and any errors
    console.log(`[DEBUG] After click - URL: ${page.url()}`);
    
    // Check for JavaScript console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    
    // Check if we navigated to lobby or room
    const currentUrl = page.url();
    const navigated = currentUrl.includes('/lobby') || currentUrl.includes('/meet/rooms/');
    
    // Check if a modal appeared
    const modal = page.locator('[role="dialog"], .modal, [data-testid="meeting-modal"]').first();
    const modalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);
    
    console.log(`[DEBUG] Navigated: ${navigated}, Modal visible: ${modalVisible}`);
    console.log(`[DEBUG] Console errors: ${consoleErrors.join(', ')}`);
    
    // The test should fail if nothing happened
    if (!navigated && !modalVisible) {
      throw new Error('New Meeting button click had no effect. No navigation, no modal, no error.');
    }
  });

  test('TC-MEET-03: Direct room access works', async ({ page }) => {
    // Try going directly to a room
    await page.goto('https://conferly.site/meet/rooms/test-playwright-room');
    await page.waitForTimeout(5000);
    
    console.log(`[DEBUG] Direct room URL: ${page.url()}`);
    
    // Should either be in the room, in lobby, or redirected to auth
    const url = page.url();
    expect(url).not.toContain('/auth');
    
    // Check if lobby or room rendered
    const lobbyContent = page.locator('text=Join, text=Ready to join, text=Camera, text=Microphone').first();
    const roomContent = page.locator('text=Leave, text=Mute, [data-testid="meeting-controls"]').first();
    
    const inLobby = await lobbyContent.isVisible({ timeout: 5000 }).catch(() => false);
    const inRoom = await roomContent.isVisible({ timeout: 5000 }).catch(() => false);
    
    console.log(`[DEBUG] In lobby: ${inLobby}, In room: ${inRoom}`);
    
    expect(inLobby || inRoom).toBeTruthy();
  });

  test('TC-MEET-04: Lobby to room flow', async ({ page }) => {
    // Go to lobby
    await page.goto('https://conferly.site/lobby?domain=meet&roomId=test-playwright-room');
    await page.waitForTimeout(3000);
    
    console.log(`[DEBUG] Lobby URL: ${page.url()}`);
    
    // Find and click Join button
    const joinBtn = page.locator(
      'button:has-text("Join"), button:has-text("Enter"), button:has-text("Start"), button[type="submit"]'
    ).first();
    
    const joinVisible = await joinBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[DEBUG] Join button visible: ${joinVisible}`);
    
    if (joinVisible) {
      await joinBtn.click();
      await page.waitForTimeout(5000);
      console.log(`[DEBUG] After join - URL: ${page.url()}`);
      
      // Should be in the room now
      expect(page.url()).toContain('/meet/rooms/');
    }
  });
});
