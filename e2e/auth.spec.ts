import { test, expect } from '@playwright/test';

test.describe('Authentication & Navigation E2E', () => {
  // Login page is a single credentials form (no demo tabs).
  // Selectors: #login-identifier, #login-password, button[type="submit"].
  test('login page loads with correct branding and form controls', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/MilkFlow/i);

    await expect(page.locator('#login-identifier')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('rejects unauthorized credentials gracefully with error message', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#login-identifier').fill('invalid.user.fake@example.com');
    await page.locator('#login-password').fill('WrongPassword123');
    await page.locator('button[type="submit"]').first().click();

    await expect(
      page.locator('[role="alert"]').or(page.locator('text=Authentication rejected')).first()
    ).toBeVisible({ timeout: 7000 });
  });

  test('authenticates Farmer / Dairy Admin and redirects to /admin', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#login-identifier').fill(process.env.E2E_FARMER_EMAIL || 'prakashpraveen239@gmail.com');
    await page.locator('#login-password').fill(process.env.E2E_FARMER_PASSWORD || 'Abc@1234');
    await page.locator('button[type="submit"]').first().click();

    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
    await expect(
      page.locator('text=MilkFlow').or(page.locator('text=Overview')).or(page.locator('text=Clients')).first()
    ).toBeVisible();
  });

  test('authenticates SuperAdmin and redirects to /superadmin', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#login-identifier').fill(process.env.E2E_ADMIN_EMAIL || 'prakashpraveen046@gmail.com');
    await page.locator('#login-password').fill(process.env.E2E_ADMIN_PASSWORD || 'Abc@1234');
    await page.locator('button[type="submit"]').first().click();

    await expect(page).toHaveURL(/\/superadmin/, { timeout: 10000 });
    await expect(
      page.locator('text=SuperAdmin').or(page.locator('text=Platform')).or(page.locator('text=Governance')).first()
    ).toBeVisible();
  });
});
