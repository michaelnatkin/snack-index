import { test, expect } from '@playwright/test';

test.describe('Welcome Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays the app title and tagline', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Snack Index' })).toBeVisible();
    await expect(page.getByText('Find your next snack')).toBeVisible();
  });

  test('displays Google sign-in button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });

  test('displays Apple sign-in button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Continue with Apple/i })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Snack Index' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Apple/i })).toBeVisible();
  });
});

