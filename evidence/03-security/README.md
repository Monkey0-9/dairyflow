# Evidence 03 — Security

- Edge firewall: `proxy.ts` + `lib/security/firewall.ts` (SQLi/XSS inspection, CSP, HSTS).
- Session HMAC: `lib/auth.ts` (tamper-evident; constant-time comparison).
- Idempotency: `lib/security/idempotency.ts` (`operation_logs.operation_id` UNIQUE).
- Invitation crypto: `lib/security/invitation-crypto.ts` (SHA-256 at rest).
- Suites: `tests/security/database-constraints.ts`, `tests/security/multi-tenant-penetration.ts`,
  `tests/security/multi-tenant-isolation.ts`, `tests/security/hostile-penetration.ts`,
  `tests/security/red-team.ts`, `tests/security/firewall-invitation-profile.ts`.
- Run: `npx vitest run tests/security/`
