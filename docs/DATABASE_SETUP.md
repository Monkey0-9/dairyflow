# 🗄️ MilkFlow - PostgreSQL Database Setup & Migration Instructions

This document outlines the step-by-step procedure to provision, configure, and migrate the production database for MilkFlow using **Neon PostgreSQL**.

---

## 📋 Technical Requirements
- **Database Engine**: PostgreSQL 15+ (Serverless Neon PostgreSQL recommended)
- **Node.js**: v18.x or v20.x
- **Environment Variables**: `DATABASE_URL` (Direct or Connection Pooled URL with SSL enabled)

---

## 1. Environment Variable Configuration

Create a `.env.production` (or `.env.local` for staging) file in your project root with your database credentials:

```env
# Database Connection String (Neon PostgreSQL)
DATABASE_URL="postgres://user:password@ep-cool-dairy-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

# JWT Secret for Session Authentication
JWT_SECRET="super-secret-random-32-byte-string-key"

# Webhook HMAC Secret Key
PAYMENT_WEBHOOK_SECRET="whsec_0123456789abcdef"

# Node Environment
NODE_ENV="production"
```

---

## 2. Executing Schema Migrations

MilkFlow includes an automated, idempotent DDL migration script located at `scripts/migrate.ts`.

### 🚀 Running the Migration Script
Run the following command from the project root:

```bash
npx tsx scripts/migrate.ts
```

### ✅ Schema Structure Verification
The migration script automatically creates 30 relational tables, indexes, and database-level CHECK constraints:

1. **`tenants`** - Multi-tenant isolation records
2. **`users`** - User accounts (FARMER, CUSTOMER, ADMIN, SUPERADMIN)
3. **`farmer_profiles`** - Dairy business settings & UPI details
4. **`customer_profiles`** - Customer subscriptions & route assignments
5. **`products`** - Milk products, unit pricing & catalog
6. **`subscriptions`** - Active delivery schedules
7. **`delivery_records`** - Daily delivery ledger & status tracking
8. **`pause_requests`** - Customer vacation pause requests
9. **`extra_milk_requests`** - One-time extra milk orders
10. **`quantity_change_requests`** - Permanent or temporary schedule changes
11. **`disputes`** - Delivery disputes & customer feedback
12. **`invoices`** - Monthly customer bill summaries
13. **`invoice_items`** - Itemized line items per delivery date
14. **`payments`** - Manual cash/UPI payment records with transaction idempotency
15. **`inventory_records`** - Production vs delivered volume balancing
16. **`day_closings`** - Daily operational closure locks
17. **`qr_identities`** - QR code authentication tokens
18. **`notifications`** - Customer and farmer alert log
19. **`activity_events`** - System event audit trail
20. **`audit_blocks`** - Cryptographic SHA-256 tamper-evident ledger chain
21. **`customer_invitations`** - Single-use token onboarding links
22. **`subscription_versions`** - Historical subscription audit versioning
23. **`product_price_histories`** - Rate per litre price history
24. **`customer_transfer_requests`** - Inter-farmer customer transfer workflows
25. **`invoice_adjustments`** - Authorized debit/credit notes
26. **`month_closings`** - Financial month-closing locks
27. **`routes` & `route_stops`** - Delivery route sequencing
28. **`customer_merge_logs`** - Duplicate profile merge logs
29. **`operation_logs`** - Idempotent API operation logs
30. **`CHECK Constraints`** - Enforces `daily_quantity >= 0`, `delivered_quantity >= 0`, `price_per_unit >= 0`, `amount > 0` at the database level.

---

## 3. Database Connection Testing

To verify connection stability and query response times:

```bash
npx vitest run tests/integration/real-postgresql-pipeline.ts
```

This executes an end-to-end integration test creating a test tenant, pre-seeding records, executing ledger updates, and calculating monthly billing.

---

## 4. Maintenance & Backups

- **Automated Backups**: Neon PostgreSQL automatically provides point-in-time recovery (PITR) up to 7 days.
- **Connection Pooling**: Neon provides built-in PgBouncer pooling via the `-pooler` hostname suffix. Use the pooler URL in serverless platforms like Vercel to prevent connection exhaustion.
