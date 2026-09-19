# Evidence 04 — Tenant Isolation

- Enforcement: `enforceTenantAccess` / `enforceCustomerOwnership` (`lib/api-auth.ts`),
  session tenant binding, `TenantIsolationInvariant` cascade
  (customer → delivery → invoice → payment parity).
- Penetration suite: `tests/security/multi-tenant-penetration.ts`
  - Direct IDOR across GET/POST/PUT/PATCH/DELETE (attacker customer as victim).
  - Indirect IDOR (Invoice A → Customer B linkage rejected).
  - Static audit: every non-public route (49 files, allowlisted health/auth/webhook/cron)
    must call `authenticateRequest` or its own auth scheme.
  - Sensitive surfaces (analytics, routes, disputes, AI copilot, statements, ledger)
    must scope by `tenantId`.
  - Service check: `getCustomersByFarmer` never leaks cross-tenant rows.
- Run: `npx vitest run tests/security/multi-tenant-penetration.ts`
