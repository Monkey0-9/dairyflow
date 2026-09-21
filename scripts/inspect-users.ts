import { query } from '../lib/db.js';

async function check() {
  const cust = await query(`
    SELECT c.*, u.email, u.phone, u.name
    FROM customer_profiles c
    JOIN users u ON c.user_id = u.id
    WHERE u.email = 'user1@dairy.com'
  `);
  console.log('Customer Profile:', cust.rows);

  const subs = await query(`
    SELECT * FROM subscriptions WHERE customer_id = $1
  `, [cust.rows[0]?.id]);
  console.log('Subscriptions:', subs.rows);

  const deliveries = await query(`
    SELECT * FROM delivery_records WHERE customer_id = $1 LIMIT 5
  `, [cust.rows[0]?.id]);
  console.log('Deliveries:', deliveries.rows);

  process.exit(0);
}
check();
