# MilkFlow 2.0 — Testing & Quality Assurance Architecture

## 1. Test Pyramid & Coverage Structure
MilkFlow 2.0 employs a comprehensive 4-tier testing hierarchy guaranteeing that every feature, security policy, and database invariant is verified both in fast isolated unit harnesses and against live PostgreSQL infrastructure.

```
                     ┌──────────────────┐
                     │   Stage 3: E2E   │  (Golden 18-Step Business Flow)
                     ├──────────────────┤
                     │ Stage 4: Security│  (Red Team Hostile Penetration)
                     ├──────────────────┤
                     │ Stage 10: Concur.│  (100 Simultaneous DB Ops)
                     ├──────────────────┤
                     │ Stage 2: Integr. │  (Live PostgreSQL Pipeline)
                     ├──────────────────┤
                     │ Unit / Component │  (Audit, Store, Auth, UI)
                     └──────────────────┘
```

---

## 2. Test Execution Commands

| Test Category | Command | Target File / Directory | Description |
| :--- | :--- | :--- | :--- |
| **Complete Test Suite** | `npm test` | `tests/**/*.test.ts*` | Runs all 25+ test suites (120+ tests) |
| **Golden Business Flow** | `npx vitest run tests/acceptance/golden-business-flow.test.ts` | `golden-business-flow.test.ts` | 18-step E2E flow from signup to invoice and audit |
| **Real PostgreSQL Integration** | `npx vitest run tests/integration/real-postgresql-pipeline.test.ts` | `real-postgresql-pipeline.test.ts` | Live Neon DB schema, constraints, and audit verification |
| **Red Team Security** | `npx vitest run tests/security/red-team.test.ts` | `red-team.test.ts` | Forged sessions, IDOR, RBAC, webhook tampering |
| **QR Hardening** | `npx vitest run tests/security/qr-hardening.test.ts` | `qr-hardening.test.ts` | Opaque QR tokens, cross-farmer scanning, revocation |
| **Concurrency & Load** | `npx vitest run tests/system/concurrency-load-recovery.test.ts` | `concurrency-load-recovery.test.ts` | 100 simultaneous concurrent DB operations, p95 benchmarks |
| **Observability Probes** | `npx vitest run tests/integration/observability.test.ts` | `observability.test.ts` | `/health`, `/ready`, `/live`, `/metrics` telemetry validation |
| **Business Operations** | `npx vitest run tests/integration/business-intelligence-operations.test.ts` | `business-intelligence-operations.test.ts` | Inventory equations, statement balances, customer 360 |

---

## 3. Mandatory Quality Gates (CI/CD Pipeline)
Every pull request and production release must pass:
1. `npm run lint` — Zero ESLint warnings or errors.
2. `npm test` — 100% test pass rate across all suites.
3. `npm run build` — Clean Next.js 16 Turbopack production compilation.
4. `npx prisma validate` — Prisma contract integrity confirmation.
