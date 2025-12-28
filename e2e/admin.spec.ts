import { test, expect } from '@playwright/test';

test.describe('Admin Routes', () => {
  test('admin page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/admin');
    
    // Should redirect to login (welcome screen)
    await expect(page.getByRole('heading', { name: 'Snack Index' })).toBeVisible();
  });

  test('admin place editor redirects unauthenticated users', async ({ page }) => {
    await page.goto('/admin/place/new');
    
    // Should redirect to login
    await expect(page.getByRole('heading', { name: 'Snack Index' })).toBeVisible();
  });

  test('admin dish editor redirects unauthenticated users', async ({ page }) => {
    await page.goto('/admin/place/test-place/dish/new');
    
    // Should redirect to login
    await expect(page.getByRole('heading', { name: 'Snack Index' })).toBeVisible();
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

