import { query, getPool } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';

async function activateRam() {
  console.log('Activating Ram account in database...');

  // 1. Hash the unified password Abc@1234
  const { hash, salt } = hashPassword('Abc@1234');

  // 2. Update users table
  const userRes = await query(`
    UPDATE users
    SET name = 'Ram',
        is_active = true,
        password_hash = $1,
        password_salt = $2
    WHERE LOWER(email) = 'user1@dairy.com'
    RETURNING id, name, email, phone, role, is_active
  `, [hash, salt]);

  console.log('Updated user:', userRes.rows);
  const userId = userRes.rows[0]?.id;
  if (!userId) {
    throw new Error('User user1@dairy.com not found!');
  }

  // 3. Update customer_profiles table
  const custRes = await query(`
    UPDATE customer_profiles
    SET is_active = true,
        daily_quantity = 1.00,
        delivery_address = 'Flat 402, Green Valley Apartments, Mysore Road'
    WHERE user_id = $1
    RETURNING id, user_id, tenant_id, farmer_id, daily_quantity, is_active
  `, [userId]);

  console.log('Updated customer profile:', custRes.rows);
  const customerId = custRes.rows[0]?.id;

  if (customerId) {
    // 4. Check if subscription exists
    const subCheck = await query(`
      SELECT id FROM subscriptions WHERE customer_id = $1
    `, [customerId]);

    const prodRes = await query(`SELECT id FROM products LIMIT 1`);
    const defaultProductId = prodRes.rows[0]?.id || 'prod_cow';

    if (subCheck.rows.length === 0) {
      await query(`
        INSERT INTO subscriptions (id, tenant_id, customer_id, product_id, quantity, delivery_time, status)
        VALUES (gen_random_uuid(), 'tenant_greenvalley', $1, $2, 1.00, 'MORNING', 'ACTIVE')
      `, [customerId, defaultProductId]);
      console.log('Created active subscription for Ram');
    } else {
      await query(`
        UPDATE subscriptions
        SET status = 'ACTIVE', quantity = 1.00
        WHERE customer_id = $1
      `, [customerId]);
      console.log('Updated subscription to ACTIVE for Ram');
    }

    // 5. Ensure today and recent delivery records exist for Ram
    const today = new Date().toISOString().split('T')[0];
    const recCheck = await query(`
      SELECT id FROM delivery_records WHERE customer_id = $1 AND date = $2
    `, [customerId, today]);

    if (recCheck.rows.length === 0) {
      await query(`
        INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status, notes)
        VALUES (gen_random_uuid(), 'tenant_greenvalley', $1, 'F001', $2, $3, 1.00, 1.00, 65.00, 'DELIVERED', 'Morning delivery completed')
      `, [customerId, defaultProductId, today]);
      console.log('Created today delivery record for Ram');
    }
  }

  console.log('Ram account successfully activated and verified!');
  await getPool().end();
  process.exit(0);
}

activateRam().catch(err => {
  console.error('Error activating Ram:', err);
  process.exit(1);
});
