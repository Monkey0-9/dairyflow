# MilkFlow 2.0 — Enterprise Security Specification

## Security Principles

MilkFlow enforces defense-in-depth across authentication, session handling, authorization, tenant isolation, and auditability.

---

## 1. Authentication & Password Security
- **Salted Password Hashing**: Passwords are never stored in plaintext. Passwords are hash-derived via `crypto.scryptSync` using a 16-byte cryptographically random salt.
- **Timing Attack Resistance**: Password verification employs `crypto.timingSafeEqual` to avoid byte-by-byte timing discrepancies.
- **HMAC-SHA256 Signed Sessions**: Session tokens are cryptographically signed with the server-side `SESSION_SECRET`.
  - Format: `base64url(payload).signature`
  - Any unauthorized modification of the payload (e.g. elevating role to `ADMIN` or changing `tenantId`) alters the expected signature and results in immediate rejection (`401 Unauthorized`).

---

## 2. Multi-Tenant Isolation & Resource Ownership
- **Tenant Isolation**: Every database query is scoped by `tenant_id`. Users from Tenant A (`GreenValley`) cannot read or mutate data from Tenant B (`Sunrise`).
- **Resource Ownership**: Customer sessions cannot specify an arbitrary `customerId` in query parameters to view other customers' invoices, deliveries, or subscriptions. All routes enforce `enforceCustomerOwnership`.
- **Farmer Isolation**: Farmers can only inspect and approve requests for customers registered under their specific `farmerId`.

---

## 3. Payment Webhook Security & Idempotency
- **Cryptographic Signature Verification**: Incoming payment webhooks require a valid HMAC signature matching `process.env.RAZORPAY_WEBHOOK_SECRET`. Unsigned or tampered webhook calls are rejected with `401 Unauthorized`.
- **Database-Enforced Idempotency**: The `payments` table enforces `UNIQUE(transaction_ref)`. If a gateway resends a webhook event (due to network timeout or retry policy), the transaction is recognized as existing and returns `ALREADY_PROCESSED` without double crediting the invoice.

---

## 4. Cryptographic SHA-256 Audit Blockchain
- **Chain of Custody**: Key platform mutations (invoice generation, dispute resolutions, day closings) are appended to `audit_blocks`.
- **Parent Hash Linking**:
  ```
  Block[i].currentHash = SHA-256(Block[i].data + Block[i-1].currentHash)
  ```
- **Tamper Detection**: An attacker modifying an existing audit record in the database will cause a hash mismatch on all subsequent blocks, flagged instantly by the SuperAdmin verification engine.
