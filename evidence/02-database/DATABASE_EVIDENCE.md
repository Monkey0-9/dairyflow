# Evidence Pack 02: Database Schemas & Relational Integrity

- **Database Engine**: Live Neon Serverless PostgreSQL.
- **Relational Tables**: 29 active tables with cascading foreign keys and unique constraints.
- **CHECK Constraints Verified**:
  - `check_customer_qty`: `daily_quantity >= 0`
  - `check_product_price`: `price_per_unit >= 0`
  - `check_delivery_delivered_qty`: `delivered_quantity >= 0`
  - `check_invoice_total`: `total_amount >= 0`
  - `check_payment_amount`: `amount > 0`
- **Constraint Test Verification**: `tests/security/database-constraints.ts` passed 100%.
