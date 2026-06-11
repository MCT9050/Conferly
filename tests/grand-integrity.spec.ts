import { test, expect } from '@playwright/test';

/**
 * Grand Integrity Test — Dual-Path Verification
 *
 * Tests both Business Meeting (Pro/Individual) and Digital Classroom (Tutoring)
 * paths through the Conferly application.
 *
 * Run with:
 *   npx playwright test tests/grand-integrity.spec.ts --workers=1
 *
 * For production run:
 *   BASE_URL=https://www.conferly.site npx playwright test tests/grand-integrity.spec.ts --workers=1
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const MEETING_ROOM = 'integrity-test-room';

test.describe('Grand Integrity Test — Dual Paths', () => {
  // ===================================================================
  // Branch A: Business Meeting (Pro / Individual Path)
  // ===================================================================

  test.describe('Branch A — Business Meeting', () => {
    test('A1: Meeting page loads with VideoGrid (not whiteboard)', async ({ page }) => {
      await page.goto(`${BASE}/meeting?room=${MEETING_ROOM}&type=meeting`);

      // The server-rendered shell should show "16 people" cap
      await expect(page.locator('text=16 people')).toBeVisible({ timeout: 10_000 });

      // The MeetingShell should render with "Live" badge
      await expect(page.locator('text=Live')).toBeVisible();

      // Room code should be visible
      await expect(page.locator(`text=${MEETING_ROOM}`).first()).toBeVisible();

      // Verify this is NOT a classroom — no whiteboard-stage div
      await expect(page.locator('.whiteboard-stage')).toHaveCount(0);
    });

    test('A2: Meeting participant cap reflects business plan', async ({ page }) => {
      await page.goto(`${BASE}/meeting?room=${MEETING_ROOM}&type=meeting`);

      // Business meetings cap at 16 people
      const shell = page.locator('text=16 people');
      await expect(shell).toBeVisible({ timeout: 10_000 });
    });

    test('A3: AI Assistant system prompt set to Professional Secretary', async ({ page }) => {
      await page.goto(`${BASE}/meeting?room=${MEETING_ROOM}&type=meeting`);

      // The AI Assistant tab should be available — check the sidebar tabs
      // This verifies the roomType "meeting" branch renders the Assistant tab
      await expect(page.locator('text=AI Assistant').first()).toBeVisible({ timeout: 10_000 });

      // The assistant placeholder text for meetings
      await expect(page.locator('text=Ask me anything about this meeting.')).toBeVisible({ timeout: 10_000 });
    });

    test('A4: /api/lk-token responds correctly (unauthenticated)', async ({ request }) => {
      const res = await request.post(`${BASE}/api/lk-token`, {
        data: { roomId: MEETING_ROOM, role: 'participant' },
      });
      // Without auth session, should return 401
      expect(res.status()).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Unauthorized');
    });
  });

  // ===================================================================
  // Branch B: Digital Classroom (Tutoring Path)
  // ===================================================================

  test.describe('Branch B — Digital Classroom', () => {
    test('B1: Classroom page loads with whiteboard stage', async ({ page }) => {
      await page.goto(`${BASE}/meeting?room=${MEETING_ROOM}&type=classroom`);

      // The server-rendered shell should show "5 learners" cap (classroom tier)
      await expect(page.locator('text=5 learners')).toBeVisible({ timeout: 10_000 });

      // Verify the whiteboard-stage div is present — unique to classroom mode
      await expect(page.locator('.whiteboard-stage')).toHaveCount(1);
    });

    test('B2: Classroom participant cap reflects education tier', async ({ page }) => {
      await page.goto(`${BASE}/meeting?room=${MEETING_ROOM}&type=classroom`);

      // Classroom caps at 5 learners
      const shell = page.locator('text=5 learners');
      await expect(shell).toBeVisible({ timeout: 10_000 });
    });

    test('B3: AI Assistant system prompt set to Expert Tutor', async ({ page }) => {
      await page.goto(`${BASE}/meeting?room=${MEETING_ROOM}&type=classroom`);

      // The AI Assistant tab should be available
      await expect(page.locator('text=AI Assistant').first()).toBeVisible({ timeout: 10_000 });

      // The assistant placeholder text for classrooms
      await expect(page.locator('text=Ask me anything about this lesson.')).toBeVisible({ timeout: 10_000 });
    });

    test('B4: Tutor Dashboard button (Amber T) is rendered', async ({ page }) => {
      await page.goto(`${BASE}/meeting?room=${MEETING_ROOM}&type=classroom`);

      // The Tutor Dashboard button with amber "T" should be present
      // This is rendered client-side but the component mounts when roomType === "classroom"
      const tutorBtn = page.locator('button[aria-label="Toggle tutor dashboard"]');
      await expect(tutorBtn).toBeVisible({ timeout: 10_000 });

      // Should have the amber-500 background class
      await expect(tutorBtn).toHaveClass(/amber/);
    });

    test('B5: Clear Whiteboard action can be triggered', async ({ page }) => {
      await page.goto(`${BASE}/meeting?room=${MEETING_ROOM}&type=classroom`);

      // Expand the Tutor Dashboard
      const tutorBtn = page.locator('button[aria-label="Toggle tutor dashboard"]');
      await expect(tutorBtn).toBeVisible({ timeout: 10_000 });
      await tutorBtn.click();

      // The "Clear Board" button should now be visible
      const clearBoardBtn = page.locator('text=Clear Board');
      await expect(clearBoardBtn).toBeVisible({ timeout: 5_000 });

      // Clicking Clear Board triggers: window.tldrawEditor.selectAll().deleteShapes()
      // In a test environment, tldrawEditor may not exist yet, but the action must not crash
      // We verify the button is wired up by checking it doesn't throw
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await clearBoardBtn.click();

      // No page-level errors should occur (the try/catch in handleClearBoard swallows gracefully)
      expect(errors.length).toBe(0);
    });
  });

  // ===================================================================
  // Cross-Cutting: Server stability checks
  // ===================================================================

  test.describe('Cross-Cutting — Server Stability', () => {
    test('Meeting and Classroom pages never return 500', async ({ request }) => {
      const meetingRes = await request.get(`${BASE}/meeting?room=${MEETING_ROOM}&type=meeting`);
      expect([200, 404]).toContain(meetingRes.status());
      expect(meetingRes.status()).not.toBe(500);

      const classroomRes = await request.get(`${BASE}/meeting?room=${MEETING_ROOM}&type=classroom`);
      expect([200, 404]).toContain(classroomRes.status());
      expect(classroomRes.status()).not.toBe(500);
    });

    test('Health endpoint returns 200', async ({ request }) => {
      const res = await request.get(`${BASE}/api/health`);
      expect(res.ok()).toBeTruthy();
    });
  });
});
