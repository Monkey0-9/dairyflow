import 'dotenv/config';
import { query, getPool } from '../lib/db';

async function cleanDemoData() {
  console.log('🧹 Purging all mock/fake demo data from Neon PostgreSQL...');

  const statements = [
    // Operational & Transactional tables (child foreign keys)
    `DELETE FROM delivery_records;`,
    `DELETE FROM invoice_adjustments;`,
    `DELETE FROM payments;`,
    `DELETE FROM invoices;`,
    `DELETE FROM disputes;`,
    `DELETE FROM pause_requests;`,
    `DELETE FROM extra_milk_requests;`,
    `DELETE FROM quantity_change_requests;`,
    `DELETE FROM subscriptions;`,
    `DELETE FROM day_closings;`,
    `DELETE FROM audit_blocks WHERE entity_type != 'SYSTEM';`,
    `DELETE FROM notifications;`,
    `DELETE FROM customer_profiles;`,
    `DELETE FROM users WHERE role = 'CUSTOMER';`,
  ];

  for (const sql of statements) {
    try {
      await query(sql);
      console.log(`  ✓ Executed: ${sql.trim()}`);
    } catch (e: any) {
      console.warn(`  ⚠️ Warning on ${sql.trim()}:`, e.message);
    }
  }

  // Ensure Farmer Profile exists
  try {
    const farmerProf = await query(`SELECT id FROM farmer_profiles WHERE user_id = 'user_farmer'`);
    if (farmerProf.rows.length === 0) {
      await query(`
        INSERT INTO farmer_profiles (id, user_id, tenant_id, business_name, upi_id, address)
        VALUES ('farmer_01', 'user_farmer', 'tenant_greenvalley', 'GreenValley Dairy', 'dairy@okaxis', 'Main Dairy Route')
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('  ✓ Verified farmer profile exists');
    } else {
      console.log('  ✓ Farmer profile already active');
    }

    // Ensure core products exist
    await query(`
      INSERT INTO products (id, tenant_id, name, code, unit, price_per_unit, description)
      VALUES 
        ('prod_cow_milk', 'tenant_greenvalley', 'Fresh Cow Milk', 'COW_MILK', 'L', 50.00, 'Farm-fresh pure cow milk'),
        ('prod_buffalo_milk', 'tenant_greenvalley', 'Rich Buffalo Milk', 'BUF_MILK', 'L', 70.00, 'Rich buffalo milk with 7% fat'),
        ('prod_a2_milk', 'tenant_greenvalley', 'Desi Gir Cow A2 Milk', 'A2_MILK', 'L', 85.00, 'Organic Desi Gir Cow A2 Milk')
      ON CONFLICT (tenant_id, code) DO UPDATE SET price_per_unit = EXCLUDED.price_per_unit;
    `);
    console.log('  ✓ Verified product catalog');

    // Count remaining customers
    const countRes = await query(`SELECT count(*) FROM customer_profiles`);
    console.log(`\n🎉 Success! Remaining customer count in DB: ${countRes.rows[0].count}`);
  } catch (err: any) {
    console.error('❌ Base verification error:', err.message);
  } finally {
    await getPool().end();
  }
}

cleanDemoData();
