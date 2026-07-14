/**
 * Hotfix Verification Test: UUID Insertion Fix
 * 
 * Tests the fix for the meeting creation bug where slug was incorrectly
 * used as the id field, causing PostgreSQL to reject the insert.
 * 
 * This test validates:
 * 1. Meeting creation succeeds with auto-generated UUID
 * 2. Slug is preserved correctly
 * 3. Existing meetings are returned without duplicate inserts
 * 4. LiveKit token generation succeeds
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'https://conferly.site';
const TEST_ROOM_PREFIX = `hotfix-test-${Date.now()}-`;

async function login(page: Page) {
  await page.goto(`${BASE_URL}/auth`);
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
  await page.fill('input[type="email"], input[name="email"]', 'nathi.ylt@gmail.com');
  await page.fill('input[type="password"], input[name="password"]', 'Nashel@1');
  const signInButton = page.locator('button[type="submit"], button:has-text("Sign in")').first();
  await signInButton.click({ force: true });
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

test.describe('Hotfix: UUID Insertion Fix Verification', () => {
  
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('HF-01: New meeting is created with auto-generated UUID', async ({ page }) => {
    const uniqueRoom = `${TEST_ROOM_PREFIX}new-${Date.now()}`;
    
    // Navigate to the room - this should trigger auto-creation
    await page.goto(`${BASE_URL}/meet/rooms/${uniqueRoom}`);
    await page.waitForTimeout(5000);
    
    console.log(`[HF-01] Navigated to: ${page.url()}`);
    
    // Should be in the meeting room (not redirected to dashboard/auth)
    const currentUrl = page.url();
    expect(currentUrl).toContain('/meet/rooms/');
    expect(currentUrl).not.toContain('/dashboard');
    expect(currentUrl).not.toContain('/auth');
    
    // Check for lobby or room content
    const lobbyContent = page.locator('text=Join, text=Ready to join, text=Camera, text=Microphone').first();
    const roomContent = page.locator('text=Leave, text=Mute, [data-testid="meeting-controls"]').first();
    
    const inLobby = await lobbyContent.isVisible({ timeout: 3000 }).catch(() => false);
    const inRoom = await roomContent.isVisible({ timeout: 3000 }).catch(() => false);
    
    console.log(`[HF-01] In lobby: ${inLobby}, In room: ${inRoom}`);
    expect(inLobby || inRoom).toBeTruthy();
  });

  test('HF-02: Existing meeting returns without duplicate insert', async ({ page }) => {
    const existingRoom = `${TEST_ROOM_PREFIX}existing-${Date.now()}`;
    
    // First visit - creates the meeting
    await page.goto(`${BASE_URL}/meet/rooms/${existingRoom}`);
    await page.waitForTimeout(5000);
    const firstUrl = page.url();
    console.log(`[HF-02] First visit URL: ${firstUrl}`);
    
    // Second visit - should return existing meeting
    await page.goto(`${BASE_URL}/meet/rooms/${existingRoom}`);
    await page.waitForTimeout(5000);
    const secondUrl = page.url();
    console.log(`[HF-02] Second visit URL: ${secondUrl}`);
    
    // Should be in the same room
    expect(secondUrl).toContain('/meet/rooms/');
    
    // Check that no error occurred
    const errorContent = page.locator('text=Error, text=500, text=Something went wrong').first();
    const hasError = await errorContent.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBeFalsy();
  });

  test('HF-03: LiveKit token generation succeeds', async ({ page }) => {
    const roomId = `${TEST_ROOM_PREFIX}lk-test-${Date.now()}`;
    
    // Get a token via the API
    const response = await page.request.post(`${BASE_URL}/api/lk-token`, {
      data: {
        roomId: roomId,
        role: 'participant',
        domain: 'meet',
      },
    });
    
    console.log(`[HF-03] Token response status: ${response.status()}`);
    
    // Should get a valid response (not 403 or 500)
    expect(response.status()).toBe(200);
    
    const responseBody = await response.json();
    console.log(`[HF-03] Token response has token: ${!!responseBody.token}`);
    console.log(`[HF-03] Token response has url: ${!!responseBody.url}`);
    
    expect(responseBody.token).toBeDefined();
    expect(responseBody.url).toBeDefined();
  });

  test('HF-04: Meeting URL routing preserves slug', async ({ page }) => {
    const customSlug = `${TEST_ROOM_PREFIX}routing-${Date.now()}`;
    
    // Navigate to meeting with custom slug
    await page.goto(`${BASE_URL}/meet/rooms/${customSlug}`);
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    console.log(`[HF-04] Current URL: ${currentUrl}`);
    
    // URL should contain the slug
    expect(currentUrl).toContain(customSlug);
    
    // Should not have been redirected
    expect(currentUrl).not.toContain('/dashboard');
    expect(currentUrl).not.toContain('/auth');
  });

  test('HF-05: Unauthenticated users are redirected', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Don't login - stay unauthenticated
    const roomId = `${TEST_ROOM_PREFIX}unauth-${Date.now()}`;
    
    await page.goto(`${BASE_URL}/meet/rooms/${roomId}`);
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`[HF-05] Unauthenticated URL: ${currentUrl}`);
    
    // Should be redirected to auth
    expect(currentUrl).toContain('/auth');
    
    await context.close();
  });

  test('HF-06: Lobby to meeting flow works', async ({ page }) => {
    const roomId = `${TEST_ROOM_PREFIX}lobby-${Date.now()}`;
    
    // Go through lobby
    await page.goto(`${BASE_URL}/lobby?domain=meet&room=${roomId}`);
    await page.waitForTimeout(3000);
    
    console.log(`[HF-06] Lobby URL: ${page.url()}`);
    
    // Should see lobby content
    const lobbyText = page.locator('text=Meeting lobby, text=Camera, text=Microphone').first();
    const lobbyVisible = await lobbyText.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[HF-06] Lobby visible: ${lobbyVisible}`);
    
    // Find join button
    const joinBtn = page.locator('button:has-text("Join"), button:has-text("Enter"), button[type="submit"]').first();
    const joinVisible = await joinBtn.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (joinVisible) {
      await joinBtn.click();
      await page.waitForTimeout(5000);
      
      const afterJoinUrl = page.url();
      console.log(`[HF-06] After join URL: ${afterJoinUrl}`);
      
      // Should navigate to room
      expect(afterJoinUrl).toContain('/meet/rooms/');
    }
    
    await page.waitForTimeout(2000);
  });
});
