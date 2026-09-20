import { test, expect } from '@playwright/test';

test.describe('Authentication & Navigation E2E', () => {
  test('login page loads with proper branding and accessibility controls', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/MilkFlow/i);
    await expect(page.locator('text=Private Client & Estate Sign In').first()).toBeVisible();
    await expect(page.locator('input[type="text"], input[type="email"], input[name="identifier"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('rejects unauthorized or non-existent credentials gracefully', async ({ page }) => {
    await page.goto('/login');
    const identifierInput = page.locator('input[type="text"], input[type="email"], input[name="identifier"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    await identifierInput.fill('invalid.user.fake@example.com');
    await passwordInput.fill('WrongPassword123');
    await submitBtn.click();

    // Check for error banner or message
    await expect(
      page.locator('text=No account found with these credentials').or(page.locator('text=Invalid credentials')).or(page.locator('[role="alert"]')).first()
    ).toBeVisible({ timeout: 7000 });
  });

  test('authenticates Farmer / Dairy Admin and redirects to /admin', async ({ page }) => {
    await page.goto('/login');
    const identifierInput = page.locator('input[type="text"], input[type="email"], input[name="identifier"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    await identifierInput.fill('prakashpraveen239@gmail.com');
    await passwordInput.fill('Abc@1234');
    await submitBtn.click();

    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
    await expect(page.locator('text=MilkFlow').or(page.locator('text=Overview')).or(page.locator('text=Customers')).first()).toBeVisible();
  });

  test('authenticates SuperAdmin and redirects to /superadmin', async ({ page }) => {
    await page.goto('/login');
    const identifierInput = page.locator('input[type="text"], input[type="email"], input[name="identifier"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    await identifierInput.fill('prakashpraveen046@gmail.com');
    await passwordInput.fill('Abc@1234');
    await submitBtn.click();

    await expect(page).toHaveURL(/\/superadmin/, { timeout: 10000 });
    await expect(page.locator('text=SuperAdmin').or(page.locator('text=Platform Assurance')).or(page.locator('text=Tenants')).first()).toBeVisible();
  });
});
