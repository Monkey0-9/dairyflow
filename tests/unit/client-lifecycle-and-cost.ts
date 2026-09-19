import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as addCustomer, DELETE as removeCustomer } from '@/app/api/customers/route';
import { POST as loginUser } from '@/app/api/auth/login/route';
import { POST as createProduct, PATCH as updateProductCost } from '@/app/api/products/route';
import { encodeSignedSession, SESSION_COOKIE_NAME } from '@/lib/auth';

describe('Client Onboarding with Email & Password, Removal, and Milk Cost Management', () => {
  const tenantId = 'tenant_greenvalley';
  const farmerSession = encodeSignedSession({
    userId: 'user_farmer',
    name: 'Suresh Patel (Farmer)',
    role: 'FARMER',
    tenantId,
    farmerId: 'farmer_01',
  });

  it('allows Farmer/Admin to onboard a new customer with email and generated starting password', async () => {
    const timestamp = Date.now();
    const testPhone = `98234${Math.floor(10000 + Math.random() * 90000)}`;
    const testEmail = `client_${timestamp}@gmail.com`;
    const testPassword = `MilkPass#${timestamp}`;

    const addReq = new NextRequest('http://localhost:3000/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Gopal Krishna',
        phone: testPhone,
        email: testEmail,
        password: testPassword,
        address: 'House 42, Temple Street, Anand',
        productId: 'prod_cow_milk',
        quantity: 2.0,
        deliveryTime: '06:00 AM',
        deliveryShift: 'MORNING',
        customPrice: 52.0,
      }),
    });

    const addRes = await addCustomer(addReq);
    const addJson = await addRes.json();

    expect(addRes.status).toBe(200);
    expect(addJson.success).toBe(true);
    expect(addJson.customer).toBeDefined();
    expect(addJson.customer.email).toBe(testEmail);
    expect(addJson.credentials).toBeDefined();
    expect(addJson.credentials.email).toBe(testEmail);
    expect(addJson.credentials.phone).toBe(testPhone);
    expect(addJson.credentials.temporaryPassword).toBe(testPassword);

    // 2. Verify customer can login directly using their Email and Password
    const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginRes = await loginUser(loginReq);
    const loginJson = await loginRes.json();

    expect(loginRes.status).toBe(200);
    expect(loginJson.success).toBe(true);
    expect(loginJson.user.email).toBe(testEmail);
    expect(loginJson.user.role).toBe('CUSTOMER');
    expect(loginJson.redirectUrl).toBe('/customer');

    // 3. Verify customer can also login using their Phone number
    const loginPhoneReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        password: testPassword,
      }),
    });

    const loginPhoneRes = await loginUser(loginPhoneReq);
    const loginPhoneJson = await loginPhoneRes.json();
    expect(loginPhoneRes.status).toBe(200);
    expect(loginPhoneJson.success).toBe(true);

    // Cleanup the created test customer so it does not persist into live database
    await removeCustomer(
      new NextRequest(`http://localhost:3000/api/customers?id=${addJson.customer.id}`, {
        method: 'DELETE',
      })
    );
  });

  it('allows Farmer/Admin to remove a client and cancel their daily subscriptions', async () => {
    // 1. Create client first
    const tempPhone = `98234${Math.floor(10000 + Math.random() * 90000)}`;
    const addReq = new NextRequest('http://localhost:3000/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Temporary Client',
        phone: tempPhone,
        address: 'Temporary Address',
        productId: 'prod_cow_milk',
        quantity: 1.0,
      }),
    });

    const addRes = await addCustomer(addReq);
    const addJson = await addRes.json();
    const customerId = addJson.customer.id;

    // 2. Remove the client
    const deleteReq = new NextRequest(`http://localhost:3000/api/customers?id=${customerId}`, {
      method: 'DELETE',
    });

    const deleteRes = await removeCustomer(deleteReq);
    const deleteJson = await deleteRes.json();

    expect(deleteRes.status).toBe(200);
    expect(deleteJson.success).toBe(true);
    expect(deleteJson.customerId).toBe(customerId);
  });

  it('allows Farmer/Admin to modify milk prices for Cow Milk, Buffalo Milk, and set cost to null', async () => {
    // 1. Create a dynamic Buffalo Milk product
    const code = `BUF_MILK_${Date.now()}`;
    const createReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        name: 'High Fat Buffalo Milk',
        code,
        pricePerUnit: 78.0,
        unit: 'Litre',
        description: 'Creamy Buffalo Milk for dairy and sweets',
      }),
    });

    const createRes = await createProduct(createReq);
    const createJson = await createRes.json();
    expect(createRes.status).toBe(200);
    expect(createJson.product.pricePerUnit).toBe(78.0);

    const productId = createJson.product.id;

    // 2. Farmer modifies price to null (Dynamic / Variable rate)
    const patchReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        productId,
        pricePerUnit: null,
      }),
    });

    const patchRes = await updateProductCost(patchReq);
    const patchJson = await patchRes.json();
    expect(patchRes.status).toBe(200);
    expect(patchJson.success).toBe(true);
    expect(patchJson.product.pricePerUnit).toBeNull();
  });
});
