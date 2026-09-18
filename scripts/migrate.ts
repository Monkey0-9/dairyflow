// Database Migration Script: Creates all relational tables and constraints in Neon PostgreSQL
import { query, testConnection } from '../lib/db';

async function migrate() {
  console.log('🚀 Starting PostgreSQL migration for MilkFlow...');
  const connected = await testConnection();
  if (!connected) {
    throw new Error('Database connection failed. Please check DATABASE_URL.');
  }
  console.log('✅ Connected to Neon PostgreSQL.');

  const ddlStatements = [
    // 1. Tenants
    `CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(128) UNIQUE NOT NULL,
      contact_email VARCHAR(255),
      contact_phone VARCHAR(64),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 2. Users
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      password_salt VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 3. Farmer Profiles
    `CREATE TABLE IF NOT EXISTS farmer_profiles (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      business_name VARCHAR(255) NOT NULL,
      upi_id VARCHAR(128) NOT NULL,
      address TEXT NOT NULL,
      route_code VARCHAR(64) DEFAULT 'ROUTE-1',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 4. Customer Profiles
    `CREATE TABLE IF NOT EXISTS customer_profiles (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
      delivery_address TEXT NOT NULL,
      milk_type VARCHAR(32) DEFAULT 'Cow',
      daily_quantity NUMERIC(5,2) DEFAULT 1.0,
      qr_token VARCHAR(128) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 5. Products
    `CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(32) NOT NULL,
      unit VARCHAR(16) DEFAULT 'L',
      price_per_unit NUMERIC(8,2) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, code)
    );`,

    // 6. Subscriptions
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL,
      quantity NUMERIC(5,2) DEFAULT 1.0,
      frequency VARCHAR(32) DEFAULT 'DAILY',
      status VARCHAR(32) DEFAULT 'ACTIVE',
      start_date TIMESTAMPTZ DEFAULT NOW(),
      end_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 7. Delivery Records (Ledger)
    `CREATE TABLE IF NOT EXISTS delivery_records (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL,
      product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      date VARCHAR(10) NOT NULL,
      scheduled_quantity NUMERIC(5,2) NOT NULL,
      delivered_quantity NUMERIC(5,2) NOT NULL,
      price_per_unit NUMERIC(8,2) NOT NULL,
      status VARCHAR(32) DEFAULT 'EXPECTED',
      delivered_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(customer_id, date, product_id)
    );`,

    // 8. Pause Requests (Vacation)
    `CREATE TABLE IF NOT EXISTS pause_requests (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL,
      start_date VARCHAR(10) NOT NULL,
      end_date VARCHAR(10) NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(32) DEFAULT 'PENDING',
      decision_notes TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 9. Extra Milk Requests
    `CREATE TABLE IF NOT EXISTS extra_milk_requests (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL,
      date VARCHAR(10) NOT NULL,
      milk_type VARCHAR(32) NOT NULL,
      quantity NUMERIC(5,2) NOT NULL,
      notes TEXT,
      status VARCHAR(32) DEFAULT 'PENDING',
      decision_notes TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 10. Quantity Change Requests
    `CREATE TABLE IF NOT EXISTS quantity_change_requests (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL,
      effective_date VARCHAR(10) NOT NULL,
      new_quantity NUMERIC(5,2) NOT NULL,
      reason TEXT,
      status VARCHAR(32) DEFAULT 'PENDING',
      decision_notes TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 11. Disputes
    `CREATE TABLE IF NOT EXISTS disputes (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL,
      delivery_id VARCHAR(64),
      date VARCHAR(10) NOT NULL,
      issue_type VARCHAR(64) NOT NULL,
      claimed_quantity NUMERIC(5,2),
      status VARCHAR(32) DEFAULT 'OPEN',
      customer_notes TEXT NOT NULL,
      resolution_notes TEXT,
      adjusted_amount NUMERIC(8,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );`,

    // 12. Invoices (with UNIQUE constraint on customer_id, month, year)
    `CREATE TABLE IF NOT EXISTS invoices (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL,
      month INT NOT NULL,
      year INT NOT NULL,
      total_quantity NUMERIC(6,2) NOT NULL,
      total_amount NUMERIC(10,2) NOT NULL,
      paid_amount NUMERIC(10,2) DEFAULT 0.0,
      outstanding_amount NUMERIC(10,2) NOT NULL,
      status VARCHAR(32) DEFAULT 'UNPAID',
      due_date TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(customer_id, month, year)
    );`,

    // 13. Invoice Items
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id VARCHAR(64) PRIMARY KEY,
      invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      date VARCHAR(10) NOT NULL,
      description VARCHAR(255) NOT NULL,
      quantity NUMERIC(5,2) NOT NULL,
      rate NUMERIC(8,2) NOT NULL,
      amount NUMERIC(10,2) NOT NULL
    );`,

    // 14. Payments (with UNIQUE constraint on transaction_ref for idempotency)
    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      method VARCHAR(32) DEFAULT 'UPI',
      transaction_ref VARCHAR(128) UNIQUE NOT NULL,
      status VARCHAR(32) DEFAULT 'SUCCESS',
      paid_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 15. Inventory Records
    `CREATE TABLE IF NOT EXISTS inventory_records (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
      date VARCHAR(10) NOT NULL,
      product_code VARCHAR(32) NOT NULL,
      production_quantity NUMERIC(6,2) NOT NULL,
      delivered_quantity NUMERIC(6,2) NOT NULL,
      waste_quantity NUMERIC(6,2) DEFAULT 0.0,
      personal_quantity NUMERIC(6,2) DEFAULT 0.0,
      opening_stock NUMERIC(6,2) DEFAULT 0.0,
      closing_stock NUMERIC(6,2) DEFAULT 0.0,
      difference NUMERIC(6,2) DEFAULT 0.0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(farmer_id, date, product_code)
    );`,

    // 16. Day Closings
    `CREATE TABLE IF NOT EXISTS day_closings (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
      date VARCHAR(10) NOT NULL,
      status VARCHAR(32) DEFAULT 'FINALIZED',
      total_production NUMERIC(6,2) NOT NULL,
      total_delivered NUMERIC(6,2) NOT NULL,
      total_waste NUMERIC(6,2) DEFAULT 0.0,
      total_personal NUMERIC(6,2) DEFAULT 0.0,
      closing_balance NUMERIC(6,2) NOT NULL,
      variance NUMERIC(6,2) DEFAULT 0.0,
      locked_by VARCHAR(64) NOT NULL,
      locked_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(farmer_id, date)
    );`,

    // 17. QR Identities
    `CREATE TABLE IF NOT EXISTS qr_identities (
      id VARCHAR(64) PRIMARY KEY,
      customer_id VARCHAR(64) UNIQUE NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      token VARCHAR(128) UNIQUE NOT NULL,
      status VARCHAR(32) DEFAULT 'ACTIVE',
      last_scanned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 18. Notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(32) DEFAULT 'INFO',
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 19. Activity Events
    `CREATE TABLE IF NOT EXISTS activity_events (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      actor_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_role VARCHAR(32) NOT NULL,
      action VARCHAR(128) NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 20. Cryptographic SHA-256 Audit Chain Blocks
    `CREATE TABLE IF NOT EXISTS audit_blocks (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      index INT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      actor_id VARCHAR(64) NOT NULL,
      actor_role VARCHAR(32) NOT NULL,
      entity_type VARCHAR(64) NOT NULL,
      entity_id VARCHAR(64) NOT NULL,
      action VARCHAR(128) NOT NULL,
      before_state TEXT,
      after_state TEXT,
      previous_hash VARCHAR(128) NOT NULL,
      current_hash VARCHAR(128) NOT NULL,
      UNIQUE(tenant_id, index)
    );`,

    // Indexes for fast querying
    `CREATE INDEX IF NOT EXISTS idx_delivery_farmer_date ON delivery_records(farmer_id, date);`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_customer_date ON delivery_records(customer_id, date);`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_farmer ON invoices(farmer_id);`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);`,
    `CREATE INDEX IF NOT EXISTS idx_activity_tenant ON activity_events(tenant_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_pause_requests_farmer ON pause_requests(farmer_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_extra_requests_farmer ON extra_milk_requests(farmer_id, status);`,
    `ALTER TABLE delivery_records ADD COLUMN IF NOT EXISTS bottles_returned INT DEFAULT 0;`,
  ];

  for (const ddl of ddlStatements) {
    await query(ddl);
  }

  console.log('✅ Successfully applied all DDL statements to PostgreSQL.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
