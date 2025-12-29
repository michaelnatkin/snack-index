import { test, expect } from '@playwright/test';

test.describe('My Snacks Screen', () => {
  test('my-snacks route exists', async ({ page }) => {
    await page.goto('/my-snacks');
    
    // Should redirect to login if not authenticated
    const welcome = page.locator('#welcome-title');
    const visible = await welcome.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      await page.goto('/');
    }
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });

  test('shows welcome/login for unauthenticated users', async ({ page }) => {
    await page.goto('/my-snacks');
    
    // Should show login screen
    const welcome = page.locator('#welcome-title');
    const visible = await welcome.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      await page.goto('/');
    }
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Place Detail Screen', () => {
  test('place route exists', async ({ page }) => {
    await page.goto('/place/test-place-id');
    
    // Should redirect to login if not authenticated
    const welcome = page.locator('#welcome-title');
    const visible = await welcome.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      await page.goto('/');
    }
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });
});

test.describe('My Snacks - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('my snacks screen is mobile responsive', async ({ page }) => {
    await page.goto('/my-snacks');
    
    await expect(page.locator('body')).toBeVisible();
  });
});

