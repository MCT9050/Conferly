import { Page, expect } from '@playwright/test';

export async function login(page: Page, baseURL: string = 'https://conferly.site') {
  await page.goto(`${baseURL}/auth`);
  
  // Wait for auth form
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
  
  // Fill credentials
  await page.fill('input[type="email"], input[name="email"]', 'nathi.ylt@gmail.com');
  await page.fill('input[type="password"], input[name="password"]', 'Nashel@1');
  
  // Click sign in button (try multiple selectors)
  const signInButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Continue")').first();
  await signInButton.click();
  
  // Wait for redirect to dashboard or app
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {
    // May already be on dashboard or may need to wait for auth completion
  });
  
  // Give time for session to settle
  await page.waitForTimeout(3000);
}

export async function logout(page: Page) {
  // Try to find logout button
  const logoutBtn = page.locator('button:has-text("Sign out"), button:has-text("Log out"), button:has-text("Logout")').first();
  if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutBtn.click();
  }
}
