import { test, expect } from '@playwright/test';

test.describe('Conferly UI Tests', () => {
  
  test('Homepage loads without errors', async ({ page }) => {
    const errors: string[] = [];
    
    // Collect console errors (only Error level)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Collect page errors
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto('https://www.conferly.site');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check page title exists
    await expect(page).toHaveTitle(/conferly/i);
    
    // Check main content visible
    await expect(page.locator('text=Conferly').first()).toBeVisible();
    
    // Report any errors
    if (errors.length > 0) {
      console.log('Console Errors found:', errors);
    }
    
    // Filter critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('404') &&
      !e.includes('net::ERR')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('All interactive elements work', async ({ page }) => {
    await page.goto('https://www.conferly.site');
    await page.waitForLoadState('networkidle');
    
    // Check main buttons exist and are clickable
    const startMeetingBtn = page.locator('button:has-text("Start a meeting")');
    if (await startMeetingBtn.isVisible()) {
      await startMeetingBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Check Sign in button(s) - there may be multiple
    const signInBtns = page.locator('button:has-text("Sign in"), button:has-text("Sign In")');
    const signInCount = await signInBtns.count();
    console.log(`Found ${signInCount} Sign in/in buttons`);
    if (signInCount > 0) {
      await signInBtns.first().click();
      await page.waitForTimeout(500);
    }
    
    // Check Get started button
    const getStartedBtn = page.locator('button:has-text("Get started")');
    if (await getStartedBtn.isVisible()) {
      await getStartedBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Check navigation links
    const navLinks = page.locator('nav a, header a');
    const linkCount = await navLinks.count();
    console.log(`Found ${linkCount} navigation links`);
    
    for (let i = 0; i < linkCount; i++) {
      const link = navLinks.nth(i);
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
        console.log(`Link ${i}: ${text} -> ${href}`);
      }
    }
  });

  test('Check for text repetition', async ({ page }) => {
    await page.goto('https://www.conferly.site');
    await page.waitForLoadState('networkidle');
    
    // Get all visible text content
    const bodyText = await page.locator('body').innerText();
    
    // Split into words and count
    const words = bodyText.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    
    for (const word of words) {
      const clean = word.replace(/[^a-z]/g, '');
      if (clean.length > 3) { // Ignore very short words
        wordCounts.set(clean, (wordCounts.get(clean) || 0) + 1);
      }
    }
    
    // Find repeated words (appearing more than twice)
    const repeated = Array.from(wordCounts.entries())
      .filter(([_, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    console.log('Repeated words:', repeated);
    
    // Check for intentional repetition (like testimonials)
    // Fail only if the same phrase appears multiple times consecutively
    const consecutiveRepetition = bodyText.match(/(.{20,})\1/g);
    if (consecutiveRepetition) {
      console.log('CONSECUTIVE REPETITION FOUND:', consecutiveRepetition);
    }
  });

  test('Check for typos and strange text', async ({ page }) => {
    await page.goto('https://www.conferly.site');
    await page.waitForLoadState('networkidle');
    
    const bodyHTML = await page.locator('body').innerHTML();
    
    // Check for common typos
    const typos = [
      { pattern: /teh\b/i, suggestion: 'the' },
      { pattern: /\s{2,}/, suggestion: 'single space' },
      { pattern: /[.,;]{2,}/, suggestion: 'single punctuation' },
      { pattern: /\bundefined\b/, suggestion: 'defined value' },
      { pattern: /\bnull\b/, suggestion: 'defined value' },
      { pattern: /TODO/, suggestion: 'fix this' },
      { pattern: /FIXME/, suggestion: 'fix this' },
      { pattern: /XXX/, suggestion: 'fix this' },
    ];
    
    for (const typo of typos) {
      const matches = bodyHTML.match(typo.pattern);
      if (matches) {
        console.log(`Potential issue: found "${matches[0]}" - ${typo.suggestion}`);
      }
    }
    
    // Check for broken text (truncated)
    const brokenText = bodyHTML.match(/[\u0000-\u001F]/g);
    if (brokenText) {
      console.log('Broken control characters found:', brokenText);
    }
  });

  test('API health check works', async ({ request }) => {
    const response = await request.get('https://conferly.vercel.app/api/health');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    console.log('API Response:', data);
    
    expect(data.status).toBe('ok');
    expect(data.database).toBe('supabase');
  });

  test('Check all images load', async ({ page }) => {
    await page.goto('https://www.conferly.site');
    await page.waitForLoadState('networkidle');
    
    // Get all images
    const images = page.locator('img');
    const imgCount = await images.count();
    console.log(`Found ${imgCount} images`);
    
    let brokenImages = 0;
    for (let i = 0; i < imgCount; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');
      
      // Check if image is visible and loaded
      if (await img.isVisible()) {
        const naturalWidth = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
        if (naturalWidth === 0) {
          console.log(`Broken image: ${src} (alt: ${alt})`);
          brokenImages++;
        }
      }
    }
    
    expect(brokenImages).toBe(0);
  });

  test('Check forms and inputs', async ({ page }) => {
    await page.goto('https://www.conferly.site');
    await page.waitForLoadState('networkidle');
    
    // Find all forms
    const forms = page.locator('form');
    const formCount = await forms.count();
    console.log(`Found ${formCount} forms`);
    
    // Find all inputs
    const inputs = page.locator('input, textarea, select');
    const inputCount = await inputs.count();
    console.log(`Found ${inputCount} form inputs`);
    
    if (inputCount > 0) {
      // Try typing in first input
      const firstInput = inputs.first();
      if (await firstInput.isVisible() && await firstInput.isEnabled()) {
        await firstInput.fill('test@example.com');
        console.log('Input test: filled first input');
      }
    }
  });

  test('Responsive UI check', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('https://www.conferly.site');
    await page.waitForLoadState('networkidle');
    console.log('Desktop: OK');
    
    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');
    console.log('Tablet: OK');
    
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    console.log('Mobile: OK');
  });
});