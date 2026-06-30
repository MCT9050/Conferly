import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test('DEBUG: Inspect all buttons on Meet dashboard', async ({ page }) => {
  await login(page, 'https://conferly.site');
  await page.goto('https://conferly.site/meet/dashboard');
  await page.waitForTimeout(3000);
  
  // Get all buttons and links on the page
  const buttons = await page.locator('button, a[role="button"], a[href]').all();
  
  console.log(`[DEBUG] Found ${buttons.length} clickable elements on Meet dashboard:`);
  
  for (let i = 0; i < buttons.length; i++) {
    const el = buttons[i];
    const text = (await el.textContent())?.trim().substring(0, 50) || '(no text)';
    const tag = await el.evaluate(e => e.tagName);
    const href = await el.getAttribute('href');
    const type = await el.getAttribute('type');
    const disabled = await el.getAttribute('disabled');
    const className = (await el.getAttribute('class'))?.substring(0, 80) || '';
    const dataTestId = await el.getAttribute('data-testid');
    
    console.log(`  [${i}] tag=${tag} text="${text}" href=${href} type=${type} disabled=${disabled} testId=${dataTestId} class="${className}"`);
  }
  
  await page.screenshot({ path: 'tests/e2e/screenshots/meet-dashboard-all-buttons.png', fullPage: true });
});

test('DEBUG: Inspect all buttons on Class dashboard', async ({ page }) => {
  await login(page, 'https://conferly.site');
  await page.goto('https://conferly.site/class/dashboard');
  await page.waitForTimeout(3000);
  
  const buttons = await page.locator('button, a[role="button"], a[href]').all();
  
  console.log(`[DEBUG] Found ${buttons.length} clickable elements on Class dashboard:`);
  
  for (let i = 0; i < buttons.length; i++) {
    const el = buttons[i];
    const text = (await el.textContent())?.trim().substring(0, 50) || '(no text)';
    const tag = await el.evaluate(e => e.tagName);
    const href = await el.getAttribute('href');
    const type = await el.getAttribute('type');
    const disabled = await el.getAttribute('disabled');
    const className = (await el.getAttribute('class'))?.substring(0, 80) || '';
    
    console.log(`  [${i}] tag=${tag} text="${text}" href=${href} type=${type} disabled=${disabled} class="${className}"`);
  }
  
  await page.screenshot({ path: 'tests/e2e/screenshots/class-dashboard-all-buttons.png', fullPage: true });
});

test('DEBUG: Click New Meeting and capture network requests', async ({ page }) => {
  await login(page, 'https://conferly.site');
  await page.goto('https://conferly.site/meet/dashboard');
  await page.waitForTimeout(3000);
  
  // Capture all network requests after clicking
  const requests: string[] = [];
  page.on('request', req => {
    requests.push(`${req.method()} ${req.url()}`);
  });
  
  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`[DEBUG] HTTP ERROR: ${res.status()} ${res.url()}`);
    }
  });
  
  page.on('console', msg => {
    console.log(`[DEBUG] CONSOLE ${msg.type()}: ${msg.text()}`);
  });
  
  // Find and click New Meeting button
  const newMeetingBtn = page.locator(
    'button:has-text("New Meeting"), button:has-text("Start Meeting"), button:has-text("Start")'
  ).first();
  
  if (await newMeetingBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[DEBUG] Clicking New Meeting button...');
    await newMeetingBtn.click();
    await page.waitForTimeout(5000);
    
    console.log(`[DEBUG] After click - URL: ${page.url()}`);
    console.log(`[DEBUG] Network requests after click:`);
    requests.forEach(r => console.log(`  ${r}`));
    
    await page.screenshot({ path: 'tests/e2e/screenshots/after-new-meeting-click.png', fullPage: true });
  } else {
    console.log('[DEBUG] New Meeting button not found!');
    
    // Dump page HTML for inspection
    const html = await page.content();
    console.log(`[DEBUG] Page HTML (first 2000 chars): ${html.substring(0, 2000)}`);
  }
});

test('DEBUG: Click Create Classroom and capture network requests', async ({ page }) => {
  await login(page, 'https://conferly.site');
  await page.goto('https://conferly.site/class/dashboard');
  await page.waitForTimeout(3000);
  
  const requests: string[] = [];
  page.on('request', req => {
    requests.push(`${req.method()} ${req.url()}`);
  });
  
  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`[DEBUG] HTTP ERROR: ${res.status()} ${res.url()}`);
    }
  });
  
  page.on('console', msg => {
    console.log(`[DEBUG] CONSOLE ${msg.type()}: ${msg.text()}`);
  });
  
  const createBtn = page.locator(
    'button:has-text("Create"), button:has-text("New Classroom"), button:has-text("Create Classroom")'
  ).first();
  
  if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[DEBUG] Clicking Create Classroom button...');
    await createBtn.click();
    await page.waitForTimeout(5000);
    
    console.log(`[DEBUG] After click - URL: ${page.url()}`);
    console.log(`[DEBUG] Network requests after click:`);
    requests.forEach(r => console.log(`  ${r}`));
    
    await page.screenshot({ path: 'tests/e2e/screenshots/after-create-classroom-click.png', fullPage: true });
  } else {
    console.log('[DEBUG] Create Classroom button not found!');
    const html = await page.content();
    console.log(`[DEBUG] Page HTML (first 2000 chars): ${html.substring(0, 2000)}`);
  }
});
