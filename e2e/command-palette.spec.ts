import { test, expect } from '@playwright/test';

test.describe('Interactive JavaScript Command Palette E2E', () => {
  test('opens via keyboard shortcut Ctrl+K and navigates using commands', async ({ page }) => {
    await page.goto('/login');

    // Trigger keyboard shortcut Ctrl+K
    await page.keyboard.press('Control+KeyK');

    // Command palette modal should be visible
    const searchInput = page.locator('input[placeholder*="Type a command"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Filter by typing
    await searchInput.fill('Client');
    await expect(page.locator('text=Client Portal: View Dashboard')).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(searchInput).not.toBeVisible();
  });
});
