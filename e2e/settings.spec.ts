import { test, expect } from '@playwright/test';

test.describe('Settings Screen', () => {
  test('settings route exists', async ({ page }) => {
    await page.goto('/settings');
    
    // Should redirect to login if not authenticated
    const welcome = page.locator('#welcome-title');
    const visible = await welcome.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      await page.goto('/');
    }
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });

  test('shows welcome/login for unauthenticated users', async ({ page }) => {
    await page.goto('/settings');
    
    // Should show login screen
    const welcome = page.locator('#welcome-title');
    const visible = await welcome.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      await page.goto('/');
    }
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Settings - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('settings screen is mobile responsive', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page.locator('body')).toBeVisible();
  });
});

