import { test, expect } from '@playwright/test';

/**
 * Core Stability Tests
 * Verifies both meeting and classroom modes boot without 500 errors.
 * Uses API-level request checks for speed instead of browser navigation.
 */
test.describe('Core Stability — Meeting Room Boot', () => {
  test('Meeting mode — GET /meeting returns non-500 (server responds)', async ({ request }) => {
    const res = await request.get('/meeting?room=test-room&type=meeting');
    const status = res.status();
    console.log(`Meeting mode — status: ${status}`);
    expect(status).not.toBe(500);
    expect(status).not.toBe(502);
    expect(status).not.toBe(503);
  });

  test('Classroom mode — GET /meeting returns non-500 (server responds)', async ({ request }) => {
    const res = await request.get('/meeting?room=test-room&type=classroom');
    const status = res.status();
    console.log(`Classroom mode — status: ${status}`);
    expect(status).not.toBe(500);
    expect(status).not.toBe(502);
    expect(status).not.toBe(503);
  });

  test('Auth page renders without 500', async ({ request }) => {
    const res = await request.get('/auth');
    const status = res.status();
    console.log(`Auth page — status: ${status}`);
    expect(res.ok()).toBe(true);
  });

  test('MeetingShell component — server responds without crash', async ({ request }) => {
    const res = await request.get('/meeting?room=test-room&type=meeting');
    const status = res.status();
    console.log(`MeetingShell route — status: ${status}`);
    expect(status).not.toBe(500);
    expect(status).not.toBe(502);
    expect(status).not.toBe(503);
  });
});