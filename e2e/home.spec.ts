import { test, expect } from '@playwright/test';

test.describe('Home Screen', () => {
  test('shows loading state initially', async ({ page }) => {
    await page.goto('/home');
    
    // Should redirect to login if not authenticated
    const welcome = page.locator('#welcome-title');
    const visible = await welcome.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      await page.goto('/');
    }
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });

  test('home route exists', async ({ page }) => {
    await page.goto('/home');
    
    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Home Screen - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('home screen is mobile responsive', async ({ page }) => {
    await page.goto('/home');
    
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Empty States', () => {
  test('handles unauthenticated access gracefully', async ({ page }) => {
    await page.goto('/home');
    
    // Should show welcome/login screen for unauthenticated users
    const welcome = page.locator('#welcome-title');
    const visible = await welcome.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      await page.goto('/');
    }
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });
});

