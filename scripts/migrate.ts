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
      status VARCHAR(32) DEFAULT 'INVITED',
      transfer_status VARCHAR(32) DEFAULT 'NONE',
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
      price_per_unit NUMERIC(8,2),
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
    `ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS transfer_status VARCHAR(32) DEFAULT 'NONE';`,
    `DO $$ BEGIN
      ALTER TABLE customer_profiles ADD CONSTRAINT check_customer_qty CHECK (daily_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `ALTER TABLE products ALTER COLUMN price_per_unit DROP NOT NULL;`,
    `DO $$ BEGIN
      ALTER TABLE products DROP CONSTRAINT IF EXISTS check_product_price;
      ALTER TABLE products ADD CONSTRAINT check_product_price CHECK (price_per_unit IS NULL OR price_per_unit >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE delivery_records ADD CONSTRAINT check_delivery_delivered_qty CHECK (delivered_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE invoices ADD CONSTRAINT check_invoice_total CHECK (total_amount >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE payments ADD CONSTRAINT check_payment_amount CHECK (amount > 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

    // 21. Customer Invitations
    `CREATE TABLE IF NOT EXISTS customer_invitations (
      id VARCHAR(64) PRIMARY KEY,
      customer_id VARCHAR(64) UNIQUE NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      token_hash VARCHAR(128) UNIQUE NOT NULL,
      channel VARCHAR(32) DEFAULT 'SMS',
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_by_id VARCHAR(64) NOT NULL,
      attempt_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 22. Subscription Versions
    `CREATE TABLE IF NOT EXISTS subscription_versions (
      id VARCHAR(64) PRIMARY KEY,
      subscription_id VARCHAR(64) NOT NULL,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity NUMERIC(5,2) NOT NULL,
      frequency VARCHAR(32) DEFAULT 'DAILY',
      shift VARCHAR(32) DEFAULT 'MORNING',
      effective_from TIMESTAMPTZ NOT NULL,
      effective_to TIMESTAMPTZ,
      created_by_id VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 23. Product Price Histories
    `CREATE TABLE IF NOT EXISTS product_price_histories (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      price_per_unit NUMERIC(8,2) NOT NULL,
      effective_from TIMESTAMPTZ NOT NULL,
      effective_to TIMESTAMPTZ,
      created_by_id VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 24. Customer Transfer Requests
    `CREATE TABLE IF NOT EXISTS customer_transfer_requests (
      id VARCHAR(64) PRIMARY KEY,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      from_farmer_id VARCHAR(64) NOT NULL,
      to_farmer_id VARCHAR(64) NOT NULL,
      status VARCHAR(32) DEFAULT 'PENDING',
      reason TEXT,
      effective_date TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );`,

    // 25. Invoice Adjustments
    `CREATE TABLE IF NOT EXISTS invoice_adjustments (
      id VARCHAR(64) PRIMARY KEY,
      invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      type VARCHAR(32) NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      reason TEXT NOT NULL,
      authorized_by VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 26. Month Closings
    `CREATE TABLE IF NOT EXISTS month_closings (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
      month INT NOT NULL,
      year INT NOT NULL,
      status VARCHAR(32) DEFAULT 'FINALIZED',
      closed_by VARCHAR(64) NOT NULL,
      closed_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(farmer_id, month, year)
    );`,

    // 27. Routes & Route Stops
    `CREATE TABLE IF NOT EXISTS routes (
      id VARCHAR(64) PRIMARY KEY,
      tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      farmer_id VARCHAR(64) NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(64) NOT NULL,
      shift VARCHAR(32) DEFAULT 'MORNING',
      agent_user_id VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS route_stops (
      id VARCHAR(64) PRIMARY KEY,
      route_id VARCHAR(64) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      customer_id VARCHAR(64) NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
      stop_sequence INT NOT NULL,
      UNIQUE(route_id, customer_id)
    );`,

    // 28. Customer Merge Logs
    `CREATE TABLE IF NOT EXISTS customer_merge_logs (
      id VARCHAR(64) PRIMARY KEY,
      primary_customer_id VARCHAR(64) NOT NULL,
      merged_customer_id VARCHAR(64) NOT NULL,
      performed_by VARCHAR(64) NOT NULL,
      merged_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 29. Operation Logs (Idempotency)
    `CREATE TABLE IF NOT EXISTS operation_logs (
      id VARCHAR(64) PRIMARY KEY,
      operation_id VARCHAR(128) UNIQUE NOT NULL,
      action VARCHAR(128) NOT NULL,
      actor_id VARCHAR(64) NOT NULL,
      result_json TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 30. Database as Final Security Boundary: CHECK constraints.
    // Idempotent DO blocks: existing deployments gain constraints without failing on re-run.
    `DO $$ BEGIN
      ALTER TABLE customer_profiles ADD CONSTRAINT chk_customer_daily_qty CHECK (daily_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE products ADD CONSTRAINT chk_product_price CHECK (price_per_unit >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE subscriptions ADD CONSTRAINT chk_subscription_qty CHECK (quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE delivery_records ADD CONSTRAINT chk_delivery_scheduled_qty CHECK (scheduled_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE delivery_records ADD CONSTRAINT chk_delivery_delivered_qty CHECK (delivered_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE delivery_records ADD CONSTRAINT chk_delivery_price CHECK (price_per_unit >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE invoices ADD CONSTRAINT chk_invoice_total_amount CHECK (total_amount >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE invoices ADD CONSTRAINT chk_invoice_paid_amount CHECK (paid_amount >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE invoices ADD CONSTRAINT chk_invoice_outstanding CHECK (outstanding_amount >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE invoices ADD CONSTRAINT chk_invoice_total_qty CHECK (total_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE invoices ADD CONSTRAINT chk_invoice_month CHECK (month BETWEEN 1 AND 12);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE invoice_items ADD CONSTRAINT chk_item_qty CHECK (quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE payments ADD CONSTRAINT chk_payment_amount CHECK (amount > 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE inventory_records ADD CONSTRAINT chk_inv_production CHECK (production_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE inventory_records ADD CONSTRAINT chk_inv_delivered CHECK (delivered_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE inventory_records ADD CONSTRAINT chk_inv_waste CHECK (waste_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE inventory_records ADD CONSTRAINT chk_inv_personal CHECK (personal_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE inventory_records ADD CONSTRAINT chk_inv_opening CHECK (opening_stock >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE inventory_records ADD CONSTRAINT chk_inv_closing CHECK (closing_stock >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE subscription_versions ADD CONSTRAINT chk_subver_qty CHECK (quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE product_price_histories ADD CONSTRAINT chk_price_hist CHECK (price_per_unit >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE invoice_adjustments ADD CONSTRAINT chk_adj_amount CHECK (amount >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE extra_milk_requests ADD CONSTRAINT chk_extra_qty CHECK (quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      ALTER TABLE quantity_change_requests ADD CONSTRAINT chk_qc_qty CHECK (new_quantity >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'INVITED';`,
    `ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS transfer_status VARCHAR(32) DEFAULT 'NONE';`,
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
