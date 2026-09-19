# Evidence Pack 01: System Architecture & Domain Model

- **System Baseline**: Next.js 16 (App Router), TypeScript (Strict), PostgreSQL (Neon Serverless pooler), Vitest.
- **Client Creation Model**: Strictly Farmer/Admin-owned creation (`INVITED` state) + SHA-256 token verification.
- **Role-Based Access Control**: 8 roles defined in `lib/types.ts` & enforced via `lib/api-auth.ts`:
  - `OWNER`, `MANAGER`, `DELIVERY_AGENT`, `ACCOUNTANT`, `SUPPORT`, `FARMER`, `CUSTOMER`, `SUPERADMIN`.
- **Public Registration**: Disabled via HTTP 403 at `/api/auth/register`.
- **Guarded Profile Self-Editing**: Enforced at `/api/customer/profile` with immutability of `farmerId`, `tenantId`, `dailyQuantity`, `milkType`, pricing.
