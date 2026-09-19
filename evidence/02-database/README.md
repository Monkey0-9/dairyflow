# Evidence 02 — Database (Final Security Boundary)

- DDL source: `scripts/migrate.ts` (tables 1–29 + CHECK constraint DO blocks, §30).
- ORM contract: `prisma/schema.prisma` (CHECK annotations on quantity/price/amount/month).
- Constraints enforced (24): non-negative quantities/prices/totals, `payments.amount > 0`,
  `invoices.month BETWEEN 1 AND 12`, UNIQUE idempotency keys (`payments.transaction_ref`,
  `operation_logs.operation_id`, `invoices[customer,month,year]`).
- Proof suite: `tests/security/database-constraints.ts` — declares every CHECK in
  migration source, verifies live `pg_constraint` rows, and attempts direct-SQL
  bypasses (negative payment/price/quantity, month=13) proving PostgreSQL rejects
  corrupt state regardless of application bugs.
- Run: `npx vitest run tests/security/database-constraints.ts`
