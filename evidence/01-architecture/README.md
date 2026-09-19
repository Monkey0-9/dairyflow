# Evidence 01 — Architecture

Chain under audit: Database Schema → API Routes → Auth → Domain Services →
Transactions → Database Constraints → Tests → Runtime Evidence.

- Schema: `prisma/schema.prisma` (29 relational models) + DDL in `scripts/migrate.ts`.
- API: 49 `app/api/**/route.ts` endpoints; auth via `lib/api-auth.ts` + `lib/auth.ts`.
- Domain services: `lib/services/*` (billing, delivery, payment, inventory, audit, subscription-pricing).
- Invariants: `lib/domain/invariants/*` unified by `index.ts` runner.
- Accounting: `lib/domain/accounting/reconciliation.ts` (Closing = Opening + Charges + Debits − Credits − Payments).
- Reliability: `lib/services/offline-sync.service.ts`, `lib/services/notification-outbox.service.ts`, `lib/observability/tracer.ts`.
- Master matrix: `PRODUCTION_ASSURANCE_AUDIT.md`.
