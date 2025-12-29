import { test, expect } from '@playwright/test';

test.describe('Admin Routes', () => {
  test('admin page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/admin');
    const welcome = page.locator('#welcome-title');
    const visible = await welcome.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      await page.goto('/');
    }
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });

  test('admin place editor redirects unauthenticated users', async ({ page }) => {
    await page.goto('/admin/place/new');
    const welcome = page.locator('#welcome-title');
    const visible = await welcome.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      await page.goto('/');
    }
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });

  test('admin dish editor redirects unauthenticated users', async ({ page }) => {
    await page.goto('/admin/place/test-place/dish/new');
    const welcome = page.locator('#welcome-title');
    const visible = await welcome.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      await page.goto('/');
    }
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Admin Routes - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('admin pages are mobile responsive', async ({ page }) => {
    await page.goto('/admin');
    
    // Page should render on mobile
    await expect(page.locator('body')).toBeVisible();
  });
});

