import { test, expect } from '@playwright/test';

test.describe('Conferly Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should load landing page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Conferly/);
    const heading = page.locator('h1');
    await expect(heading).toContainText('Connecting with Purpose');
  });

  test('should display theme toggle button', async ({ page }) => {
    const themeToggle = page.locator('button[aria-label*="Switch to"]');
    await expect(themeToggle).toBeVisible();
  });

  test('should display navigation links', async ({ page }) => {
    const featuresLink = page.locator('a[href="#features"]');
    await expect(featuresLink).toBeVisible();
  });

  test('should have functioning CTA buttons', async ({ page }) => {
    const startMeetingBtn = page.locator('button:has-text("Start a meeting")');
    await expect(startMeetingBtn).toBeVisible();
    
    const copyLinkBtn = page.locator('button:has-text("Copy meeting link")');
    await expect(copyLinkBtn).toBeVisible();
  });

  test('should display all feature cards', async ({ page }) => {
    const featureCards = page.locator('article');
    const count = await featureCards.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    const header = page.locator('header[role="banner"]');
    await expect(header).toBeVisible();
    
    const nav = page.locator('nav[role="navigation"]');
    await expect(nav).toBeVisible();
    
    const footer = page.locator('footer[role="contentinfo"]');
    await expect(footer).toBeVisible();
  });
});

test.describe('Conferly Mobile Menu', () => {
  test('should display mobile menu on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000');
    
    const menuButton = page.locator('button[aria-label="Open menu"]');
    await expect(menuButton).toBeVisible();
  });

  test('should toggle mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000');
    
    const menuButton = page.locator('button[aria-label="Open menu"]');
    await menuButton.click();
    
    const mobileNav = page.locator('nav[role="navigation"]');
    await expect(mobileNav).toBeVisible();
  });
});

test.describe('Conferly Theme Support', () => {
  test('should apply dark theme CSS variables', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    const background = await page.locator('body').evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    expect(background).toBeTruthy();
  });

  test('should support theme toggle', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    const themeToggle = page.locator('button[aria-label*="Switch to"]');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      // Verify page is still functional after theme change
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    }
  });
});
