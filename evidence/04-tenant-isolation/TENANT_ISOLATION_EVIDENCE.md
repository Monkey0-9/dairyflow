# Evidence Pack 04: Multi-Tenant Isolation & IDOR Penetration Results

- **Isolation Model**: Multi-tenant database partitioning on every table via `tenant_id`.
- **Session Enforcement**: `tenant_id` resolved exclusively from verified cryptographically signed session cookies, never trusted from client request body.
- **Penetration Test Results (`tests/security/multi-tenant-penetration.ts`)**:
  - Direct IDOR across `GET /api/customers`: ✅ BLOCKED (Zero cross-tenant records exposed).
  - Indirect IDOR across `POST /api/customer/transfer`: ✅ BLOCKED (Cross-tenant transfer rejected).
  - Cross-tenant invoice leakage: ✅ BLOCKED.
  - Cross-tenant logistics route visibility: ✅ BLOCKED.
