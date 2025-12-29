import { test, expect } from '@playwright/test';

test.describe('Welcome Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays the app title and tagline', async ({ page }) => {
    await expect(page.locator('#welcome-title')).toBeVisible();
    await expect(page.locator('#welcome-tagline')).toBeVisible();
  });

  test('displays Google sign-in button', async ({ page }) => {
    await expect(page.locator('#google-signin')).toBeVisible({ timeout: 10000 });
  });

  test('displays Apple sign-in button', async ({ page }) => {
    await expect(page.locator('#apple-signin')).toBeVisible({ timeout: 10000 });
  });

  test('displays terms and privacy text', async ({ page }) => {
    await expect(page.getByText(/Terms of Service and Privacy Policy/i)).toBeVisible();
  });

  test('has correct page title', async ({ page }) => {
    await expect(page).toHaveTitle('Snack Index');
  });
});

test.describe('Welcome Screen - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('is responsive on mobile', async ({ page }) => {
    await page.goto('/');
    
    // All key elements should be visible on mobile
    await expect(page.locator('#welcome-title')).toBeVisible();
    await expect(page.locator('#google-signin')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#apple-signin')).toBeVisible({ timeout: 10000 });
  });
});

