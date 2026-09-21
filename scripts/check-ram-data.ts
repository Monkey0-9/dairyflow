import { query, getPool } from '../lib/db';

async function check() {
  const users = await query(`SELECT * FROM users WHERE email = 'user1@dairy.com'`);
  console.log('USER1:', users.rows);

  if (users.rows.length > 0) {
    const cust = await query(`SELECT * FROM customer_profiles WHERE user_id = $1`, [users.rows[0].id]);
    console.log('CUSTOMER PROFILE:', cust.rows);

    if (cust.rows.length > 0) {
      const invs = await query(`SELECT * FROM invoices WHERE customer_id = $1`, [cust.rows[0].id]);
      console.log('INVOICES FOR CUST:', invs.rows);
    }
  }

  await getPool().end();
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
