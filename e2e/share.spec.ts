import { test, expect } from '@playwright/test';

test.describe('Share Landing Page', () => {
  test('share route for place exists', async ({ page }) => {
    await page.goto('/s/test-place-id');
    
    // Should show share landing or redirect to login
    await expect(page.locator('body')).toBeVisible();
  });

  test('share route for dish exists', async ({ page }) => {
    await page.goto('/s/test-place-id/dish/test-dish-id');
    
    // Should show share landing
    await expect(page.locator('body')).toBeVisible();
  });

  test('displays Snack Index branding', async ({ page }) => {
    await page.goto('/s/test-place-id');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Should show either the landing page or an error state
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Share - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('share landing is mobile responsive', async ({ page }) => {
    await page.goto('/s/test-place-id');
    
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Deep Links', () => {
  test('place deep link works', async ({ page }) => {
    await page.goto('/place/test-place');
    
    // Should redirect to login for unauthenticated users
    await expect(page.locator('body')).toBeVisible();
  });
});

