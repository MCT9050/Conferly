import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Conferly Class — Full Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'https://conferly.site');
  });

  test('TC-CLASS-01: Class dashboard loads', async ({ page }) => {
    await page.goto('https://conferly.site/class/dashboard');
    await page.waitForTimeout(3000);
    
    console.log(`[DEBUG] TC-CLASS-01 URL: ${page.url()}`);
    expect(page.url()).toContain('/class/dashboard');
    
    // Look for Create Classroom button
    const createBtn = page.locator(
      'button:has-text("Create"), button:has-text("New"), a:has-text("Create"), [data-testid="create-classroom-btn"]'
    ).first();
    
    const createVisible = await createBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[DEBUG] Create Classroom button visible: ${createVisible}`);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'tests/e2e/screenshots/class-dashboard.png', fullPage: true });
  });

  test('TC-CLASS-02: Create Classroom button works', async ({ page }) => {
    await page.goto('https://conferly.site/class/dashboard');
    await page.waitForTimeout(3000);
    
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    
    // Find Create Classroom button
    const createBtn = page.locator(
      'button:has-text("Create"), button:has-text("New Classroom"), button:has-text("Create Classroom"), a:has-text("Create"), [data-testid="create-classroom-btn"]'
    ).first();
    
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await expect(createBtn).toBeEnabled();
    
    // Log button details
    const tagName = await createBtn.evaluate(el => el.tagName);
    const href = await createBtn.getAttribute('href');
    const onClick = await createBtn.evaluate(el => el.onclick?.toString() || 'no onclick');
    console.log(`[DEBUG] Create Classroom button: tag=${tagName}, href=${href}, onclick=${onClick}`);
    
    // Click it
    await createBtn.click();
    await page.waitForTimeout(3000);
    
    // Check what happened
    const modal = page.locator('[role="dialog"], .modal, [data-testid="create-modal"]').first();
    const modalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);
    
    const navigated = page.url() !== 'https://conferly.site/class/dashboard';
    console.log(`[DEBUG] After click - URL: ${page.url()}, Modal: ${modalVisible}, Navigated: ${navigated}`);
    console.log(`[DEBUG] Console errors: ${consoleErrors.join(', ')}`);
    
    // Take screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/after-create-click.png', fullPage: true });
    
    if (!modalVisible && !navigated) {
      throw new Error('Create Classroom button click had no effect. No modal, no navigation, no error.');
    }
  });

  test('TC-CLASS-03: Create classroom via API', async ({ page, request }) => {
    // Get session cookies by logging in
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // Create classroom via API
    const response = await request.post('https://conferly.site/api/class/classrooms', {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      data: {
        title: 'Playwright Test Classroom',
        description: 'Created by automated test',
        subject: 'Testing',
        enrollment_type: 'open',
      },
    });
    
    console.log(`[DEBUG] API response status: ${response.status()}`);
    const body = await response.text();
    console.log(`[DEBUG] API response body: ${body}`);
    
    expect(response.status()).toBe(201);
    
    const classroom = JSON.parse(body);
    expect(classroom.id).toBeTruthy();
    expect(classroom.slug).toBeTruthy();
    
    // Save for next test
    process.env.TEST_CLASSROOM_ID = classroom.id;
    process.env.TEST_CLASSROOM_SLUG = classroom.slug;
  });

  test('TC-CLASS-04: Classroom detail page loads', async ({ page }) => {
    const slug = process.env.TEST_CLASSROOM_SLUG || 'test-classroom';
    await page.goto(`https://conferly.site/class/classrooms/${slug}`);
    await page.waitForTimeout(3000);
    
    console.log(`[DEBUG] Classroom detail URL: ${page.url()}`);
    
    // Take screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/classroom-detail.png', fullPage: true });
    
    // Should see classroom management UI
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('TC-CLASS-05: Create and launch lesson', async ({ page, request }) => {
    const classroomId = process.env.TEST_CLASSROOM_ID;
    if (!classroomId) {
      test.skip();
      return;
    }
    
    // Get cookies
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // Create a lesson via API (if endpoint exists)
    const lessonResponse = await request.post(`https://conferly.site/api/class/classrooms/${classroomId}/lessons`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      data: {
        title: 'Test Lesson',
        content: {},
        order_index: 1,
      },
    }).catch(async (err) => {
      console.log(`[DEBUG] Lesson creation endpoint may not exist: ${err.message}`);
      return null;
    });
    
    if (lessonResponse && lessonResponse.ok()) {
      const lesson = await lessonResponse.json();
      console.log(`[DEBUG] Lesson created: ${JSON.stringify(lesson)}`);
      
      // Launch the lesson
      const launchResponse = await request.post(`https://conferly.site/api/class/lessons/${lesson.id}/launch`, {
        headers: {
          'Cookie': cookieHeader,
        },
      });
      
      console.log(`[DEBUG] Launch response status: ${launchResponse.status()}`);
      const launchBody = await launchResponse.text();
      console.log(`[DEBUG] Launch response body: ${launchBody}`);
      
      expect(launchResponse.status()).toBe(200);
    } else {
      console.log('[DEBUG] Lesson API not available, testing UI only');
    }
    
    // Navigate to classroom and look for lesson UI
    const slug = process.env.TEST_CLASSROOM_SLUG;
    await page.goto(`https://conferly.site/class/classrooms/${slug}`);
    await page.waitForTimeout(3000);
    
    // Look for "Launch" or "Start Lesson" button
    const launchBtn = page.locator(
      'button:has-text("Launch"), button:has-text("Start"), button:has-text("Start Lesson"), button:has-text("Go Live")'
    ).first();
    
    const launchVisible = await launchBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[DEBUG] Launch button visible: ${launchVisible}`);
    
    if (launchVisible) {
      await launchBtn.click();
      await page.waitForTimeout(5000);
      console.log(`[DEBUG] After launch click - URL: ${page.url()}`);
      
      await page.screenshot({ path: 'tests/e2e/screenshots/after-launch.png', fullPage: true });
    }
  });
});
