import { test, expect } from '@playwright/test';

test.describe('Client Creation & Client Login E2E', () => {
  const uniqueSuffix = Date.now().toString().slice(-6);
  const testPhone = `+9198${uniqueSuffix}12`;
  const testEmail = `client_${uniqueSuffix}@dairytest.com`;
  const testPassword = 'Client@12345';
  const testName = `Playwright Test Client ${uniqueSuffix}`;

  test('Farmer logs in, creates client, and client immediately logs into /customer', async ({ page, request }) => {
    // Step 1: Log in as Farmer to create a client via API endpoint
    const loginRes = await request.post('/api/auth/login', {
      data: {
        userIdentifier: 'prakashpraveen239@gmail.com',
        password: 'Abc@1234',
      },
    });
    expect(loginRes.status()).toBe(200);

    // Step 2: Create a new customer with our custom password
    const createRes = await request.post('/api/customers', {
      data: {
        name: testName,
        phone: testPhone,
        email: testEmail,
        address: 'Flat 101, Playwright Heights',
        productId: 'prod_cow_milk',
        quantity: '2.0',
        deliveryShift: 'MORNING',
        password: testPassword,
      },
    });
    expect(createRes.status()).toBe(200);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.credentials).toBeDefined();
    expect(createData.credentials.phone).toBe(testPhone);

    // Step 3: Test Browser UI Login as the new client using PHONE NUMBER
    await page.goto('/login');
    const identifierInput = page.locator('input[type="text"], input[type="email"], input[name="identifier"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    await identifierInput.fill(testPhone);
    await passwordInput.fill(testPassword);
    await submitBtn.click();

    // Verify redirected to /customer portal
    await expect(page).toHaveURL(/\/customer/, { timeout: 10000 });
    await expect(page.locator(`text=${testName}`).or(page.locator('text=Customer Portal')).or(page.locator('text=MilkFlow'))).toBeVisible();

    // Step 4: Verify navigation to Customer QR Verification page
    await page.goto('/customer/qr');
    await expect(page).toHaveURL(/\/customer\/qr/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Private Client Pass' })).toBeVisible({ timeout: 8000 });

    // Step 5: Test Client Login using EMAIL
    await page.context().clearCookies();
    await page.goto('/login');
    await page.locator('input[type="text"], input[type="email"], input[name="identifier"]').first().fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('button[type="submit"]').first().click();

    await expect(page).toHaveURL(/\/customer/, { timeout: 10000 });
  });
});
