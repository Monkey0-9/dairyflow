import { query } from '../lib/db';
import { hashPassword } from '../lib/auth';

async function main() {
  const adminPwd = hashPassword('Abc@1234');
  const farmerPwd = hashPassword('Abc@1234');

  // Ensure tenant exists
  await query(
    `INSERT INTO tenants (id, name, slug, contact_email, is_active)
     VALUES ('tenant_greenvalley', 'Green Valley Dairy', 'green-valley', 'prakashpraveen046@gmail.com', true)
     ON CONFLICT (id) DO NOTHING`
  );

  // 1. SuperAdmin
  await query(
    `INSERT INTO users (id, tenant_id, email, phone, name, role, password_hash, password_salt, is_active)
     VALUES ('user_admin', 'tenant_greenvalley', 'prakashpraveen046@gmail.com', '+919980592787', 'Praveen', 'SUPERADMIN', $1, $2, true)
     ON CONFLICT (id) DO UPDATE SET email = 'prakashpraveen046@gmail.com', phone = '+919980592787', name = 'Praveen', password_hash = $1, password_salt = $2, is_active = true`,
    [adminPwd.hash, adminPwd.salt]
  );

  // 2. Farmer / Dairy Owner
  await query(
    `INSERT INTO users (id, tenant_id, email, phone, name, role, password_hash, password_salt, is_active)
     VALUES ('user_farmer', 'tenant_greenvalley', 'prakashpraveen239@gmail.com', '+99980592787', 'Prakash', 'FARMER', $1, $2, true)
     ON CONFLICT (id) DO UPDATE SET email = 'prakashpraveen239@gmail.com', phone = '+99980592787', name = 'Prakash', password_hash = $1, password_salt = $2, is_active = true`,
    [farmerPwd.hash, farmerPwd.salt]
  );

  // Ensure farmer_profiles has user_farmer
  await query(
    `INSERT INTO farmer_profiles (id, tenant_id, user_id, business_name, upi_id, address)
     VALUES ('farmer_01', 'tenant_greenvalley', 'user_farmer', 'Green Valley Dairy', 'greenvalley@okhdfcbank', 'Plot 42, Anand Dairy Road, Anand, Gujarat - 388001')
     ON CONFLICT (id) DO NOTHING`
  );

  console.log('Successfully upserted superadmin and farmer accounts.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
