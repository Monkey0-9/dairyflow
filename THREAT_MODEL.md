# MilkFlow 2.0 — Enterprise Threat Model & Security Posture
**Classification**: Confidentially Assured Enterprise Architecture  
**Authoritative Scope**: MilkFlow 2.0 Multi-Tenant Digital Dairy Management Platform  
**Specification Standard**: STRIDE-aligned Asset-Threat-Attack-Control-Test (ATACT) Framework  
**Verification Status**: Validated against Automated Red Team Tests (`tests/security/red-team.test.ts`)

---

## 1. Executive Summary & Security Objectives
MilkFlow handles core physical supply-chain logistics, household PII, financial invoicing, and payment processing for milk producers and consumers. The security posture is defined around five zero-trust principles:
1. **Zero-Trust Identity**: Every API mutation and query independently validates session authentication, role bounds, and tenant boundaries.
2. **Cryptographic Integrity**: Auditing and data tampering are detected via SHA-256 block hash-chaining and HMAC signatures.
3. **Defense-in-Depth Tenant Isolation**: Row-level filtering (`tenant_id`) enforced across both ORM and raw SQL query layers.
4. **Financial Idempotency**: Payment events and balance settlements reject replays, duplicates, and out-of-order execution.
5. **Decoupled AI & Resilient Operations**: Core dairy logistics, ledger writes, and billing operations run strictly deterministically without relying on third-party AI or external availability.

---

## 2. Threat Modeling Matrix (Asset → Threat → Attack → Control → Test)

| # | Asset | Threat (STRIDE) | Attack Vector | Control Mechanism | Verification Test |
|---|-------|-----------------|---------------|-------------------|-------------------|
| **1** | **User Session** | Tampering / Spoofing | Forged or tampered payload with modified `userId`, `role`, or `tenantId` | Cryptographic HMAC-SHA256 session token signatures (`payload.signature`) using server-only `SESSION_SECRET` with constant-time equality check | `tests/security/red-team.test.ts` (Authentication Attacks) |
| **2** | **Session Lifetime** | Information Disclosure / Replay | Replay of stolen session token after logout or timeout | Enforced `exp` timestamp in session token claims; rejection if `Date.now() > exp` | `tests/security/red-team.test.ts` (Expired session token test) |
| **3** | **Customer PII & Invoices** | Information Disclosure / Elevation | Insecure Direct Object Reference (IDOR) via query param `?customerId=...` | `enforceCustomerOwnership()` verifies `session.customerId === requestedCustomerId` | `tests/security/red-team.test.ts` (IDOR Protection) |
| **4** | **Farmer Operations API** | Elevation of Privilege | Malicious Customer invoking Farmer or Admin routes (`/api/farmer/*`) | RBAC enforcement via `authenticateRequest(req, ['FARMER', 'ADMIN'])` returning 403 Forbidden | `tests/security/red-team.test.ts` (Vertical Role Escalation) |
| **5** | **SuperAdmin Governance** | Elevation of Privilege | Farmer escalating to SuperAdmin to manipulate cross-tenant registries | Strict `SUPERADMIN` role check; separation of SuperAdmin secrets and API endpoints | `tests/security/red-team.test.ts` (SuperAdmin Gate test) |
| **6** | **Multi-Tenant Boundaries** | Information Disclosure / Cross-Tenant Leakage | Farmer A querying Farmer B customers, routes, or sales ledger | Strict `enforceTenantAccess()` matching `session.tenantId === resource.tenantId` in all queries | `tests/security/red-team.test.ts` (Cross-Tenant Isolation) |
| **7** | **Payment Webhooks** | Tampering / Financial Spoofing | Malicious actor posting fake payment confirmations or altered amounts | HMAC-SHA256 signature verification over raw request body using `RAZORPAY_WEBHOOK_SECRET` | `tests/security/red-team.test.ts` (Payment Webhook Attacks) |
| **8** | **Financial Ledger** | Repudiation / Double Spend | Network replay of captured payment webhook or multiple rapid checkout clicks | Transaction reference idempotency table (`payments.transaction_ref UNIQUE`); duplicate returns `ALREADY_PROCESSED` | `tests/security/red-team.test.ts` (Webhook Idempotency test) |
| **9** | **Audit Trail** | Tampering / Repudiation | Rogue insider altering historical delivery or payment records | Cryptographic SHA-256 blockchain ledger (`audit_logs`) linking `previous_hash` sequentially; verified with `verifyAuditChain()` | `tests/integration/real-postgresql-pipeline.test.ts` (Step 10 Audit Verification) |
| **10** | **Delivery QR Codes** | Spoofing / Eavesdropping | Customer QR code copied or decoded to steal customer account details | Opaque unguessable UUID tokens (`qr_token`); zero customer PII in QR payload; token revocation and periodic rotation | `tests/component/qr-delivery.test.ts` |
| **11** | **API Surface** | Denial of Service (DoS) / Brute Force | High-frequency automated attacks against login or webhook endpoints | In-memory sliding window rate limiter (`checkRateLimit`) throttling per IP/Identifier | `tests/security/red-team.test.ts` (Sliding Window Rate Limiter test) |
| **12** | **Input Processing** | Tampering / Crash | Malformed JSON payloads or oversized payloads crashing backend node runtime | Defensive `try/catch` JSON parsing returning standard HTTP 400/500 JSON without stack trace leakage | `tests/security/red-team.test.ts` (Malformed JSON test) |
| **13** | **Database Layer** | Injection / Data Loss | SQL injection via dynamic query concatenation | Parameterized queries ($1, $2, ...) exclusively across all database adapters | `lib/db.ts` & `tests/integration/real-postgresql-pipeline.test.ts` |
| **14** | **AI Copilot** | Misinformation / Direct Execution | LLM generating hallucinated answers or attempting direct financial mutation | Read-only evidence citation requirement; zero write permissions granted to AI runtime | `lib/services/ai.service.ts` |
| **15** | **Offline Synchronization** | Inconsistent State / Double Delivery | Delivery agent recording drops offline and syncing multiple times | Client-generated UUID `operationId` + database upsert/conflict resolution on `(customer_id, date)` | `tests/component/offline-sync.test.ts` |
| **16** | **Notification Engine** | Information Disclosure / Spam | Unsolicited or cross-customer delivery notification leakage | Tenant and customer-scoped notification queues with template sanitization | `lib/events.ts` |

---

## 3. Threat Mitigation Architecture

```
                       [ Incoming Untrusted Request ]
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ Edge & Rate Limiting Gate │
                        │  (checkRateLimit 60r/min) │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ HMAC Session Authentication│
                        │ (Signature + Expiry Claim)│
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ RBAC Role Permission Gate │
                        │ (CUSTOMER/FARMER/ADMIN)   │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ Tenant & IDOR Ownership   │
                        │ (TenantMatch + CustMatch) │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ Parameterized SQL Engine  │
                        │  (Neon PostgreSQL Pool)   │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ SHA-256 Audit Blockchain  │
                        │  (Append-Only Log Chain)  │
                        └───────────────────────────┘
```

---

## 4. Production Security Baseline
- **Secrets Management**: No secret credentials committed to version control. Environment variables loaded via `.env` with strict fallback barriers in production.
- **Data Protection**: All external data transfer encrypted over TLS 1.3. Database connections mandate SSL (`sslmode=require` / `verify-full`).
- **Cryptographic Algorithms**: Salted `scrypt` for credential storage, `HMAC-SHA256` for session and webhook authentication, `SHA-256` for immutable audit block linking.
