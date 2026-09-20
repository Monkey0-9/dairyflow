async function testCustomerFlow() {
  console.log('1. Farmer logging in at /api/auth/login...');
  const farmerLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'prakashpraveen239@gmail.com',
      password: 'Abc@1234',
    }),
  });

  const farmerCookie = farmerLoginRes.headers.get('set-cookie');
  console.log('Farmer login status:', farmerLoginRes.status, 'Cookie received:', !!farmerCookie);

  // Extract milkflow_session cookie
  const sessionMatch = farmerCookie?.match(/milkflow_session=([^;]+)/);
  const sessionToken = sessionMatch ? sessionMatch[1] : '';

  const uniquePhone = '+9199' + Math.floor(10000000 + Math.random() * 90000000);
  const uniqueEmail = 'client_' + Date.now() + '@gmail.com';
  const customPass = 'Client@12345';

  console.log('2. Admin creating customer with phone:', uniquePhone, 'email:', uniqueEmail, 'password:', customPass);
  const addRes = await fetch('http://localhost:3000/api/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `milkflow_session=${sessionToken}`,
    },
    body: JSON.stringify({
      name: 'Rohan Sharma',
      phone: uniquePhone,
      email: uniqueEmail,
      password: customPass,
      address: 'House 42, Park Street',
      productId: 'prod_cow_milk',
      quantity: 1.5,
    }),
  });

  const addData = await addRes.json();
  console.log('Creation response status:', addRes.status, 'data:', addData);

  console.log('3. Attempting login as created customer using email:', uniqueEmail);
  const loginRes1 = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: uniqueEmail,
      password: customPass,
    }),
  });
  const loginData1 = await loginRes1.json();
  console.log('Login with email result:', loginRes1.status, loginData1);

  console.log('4. Attempting login as created customer using phone:', uniquePhone);
  const loginRes2 = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: uniquePhone,
      password: customPass,
    }),
  });
  const loginData2 = await loginRes2.json();
  console.log('Login with phone result:', loginRes2.status, loginData2);
}

testCustomerFlow()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
