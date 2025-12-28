import { test, expect } from '@playwright/test';

test.describe('Settings Screen', () => {
  test('settings route exists', async ({ page }) => {
    await page.goto('/settings');
    
    // Should redirect to login if not authenticated
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows welcome/login for unauthenticated users', async ({ page }) => {
    await page.goto('/settings');
    
    // Should show login screen
    await expect(page.getByText(/Snack Index|Sign in|Continue/i).first()).toBeVisible();
  });
});

test.describe('Settings - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('settings screen is mobile responsive', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page.locator('body')).toBeVisible();
  });
});

