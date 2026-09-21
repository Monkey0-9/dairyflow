import { query, getPool } from '../lib/db';

async function seedRamInvoice() {
  const users = await query(`SELECT * FROM users WHERE email = 'user1@dairy.com'`);
  if (users.rows.length === 0) {
    console.error('User1 not found');
    process.exit(1);
  }
  const user = users.rows[0];

  const custRes = await query(`SELECT * FROM customer_profiles WHERE user_id = $1`, [user.id]);
  if (custRes.rows.length === 0) {
    console.error('Customer profile not found for user1');
    process.exit(1);
  }
  const cust = custRes.rows[0];

  // Insert or update invoice for Ram for Sept 2026
  await query(
    `INSERT INTO invoices (
      id, tenant_id, customer_id, farmer_id, month, year,
      total_amount, paid_amount, outstanding_amount, status,
      due_date, total_quantity
    ) VALUES (
      'inv_ram_202609', $1, $2, $3, 9, 2026,
      1500.00, 0.00, 1500.00, 'UNPAID',
      '2026-09-30', 25.0
    ) ON CONFLICT (customer_id, month, year) DO UPDATE SET
      total_amount = 1500.00,
      outstanding_amount = 1500.00,
      paid_amount = 0.00,
      status = 'UNPAID'`,
    [cust.tenant_id, cust.id, cust.farmer_id || 'F001']
  );

  console.log('Successfully created/verified invoice for Ram: inv_ram_202609 (₹1,500.00)');
  await getPool().end();
  process.exit(0);
}

seedRamInvoice().catch(err => {
  console.error(err);
  process.exit(1);
});
