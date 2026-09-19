# Software Requirements Specification (SRS) - MilkFlow

## 1. System Requirements & Business Scope

MilkFlow is a high-reliability enterprise dairy operating platform designed to orchestrate daily milk supply logistics, customer subscriptions, delivery ledgers, monthly billing cutoffs, payment reconciliations, and inventory tracking.

---

## 2. Functional Requirements (FR)

### FR-01: Farmer-Owned Client Creation & Invitation
- Direct public customer self-registration is strictly prohibited (`HTTP 403 Forbidden`).
- Farmers or Dairy Admins create customer records in the `INVITED` state.
- System generates a cryptographically random invitation token, stores its SHA-256 hash at rest in `CustomerInvitation`, and dispatches it via SMS/WhatsApp/QR.
- Customers activate their portal via `/api/auth/activate-customer`, set password/PIN, and transition state from `INVITED` to `ACTIVE`.

### FR-02: Customer Profile Self-Editing Guard
- Registered customers can edit personal contact details (**Name**, **Phone**, **Delivery Address**, **Email**).
- Immutability Guard: Server rejects any payload attempting to modify `farmerId`, `tenantId`, `dailyQuantity`, `milkType`, or subscription parameters.

### FR-03: Expected vs Actual Delivery Ledger
- System tracks `scheduledQuantity`, `deliveredQuantity`, `status` (`EXPECTED`, `DELIVERED`, `PARTIAL`, `SKIPPED`, `EXTRA`, `NOT_DELIVERED`, `DISPUTED`), and locked `pricePerUnit`.
- Transactional row locks (`SELECT FOR UPDATE`) prevent race conditions during day closing.

### FR-04: Subscription Versioning & Pricing History
- `SubscriptionVersion`: Effective-dated subscription tracking with non-overlapping `effectiveFrom` / `effectiveTo` period invariants.
- `ProductPriceHistory`: Effective-dated price lookups. Deliveries and invoices lock unit prices at the time of delivery scheduling/billing.

### FR-05: Monthly Billing Cutoff & Double-Entry Balance
- `Closing Balance = Opening Balance + Period Charges + Debits - Credits - Payments`.
- Issued invoices are immutable; billing corrections require `InvoiceAdjustment` (`CREDIT_NOTE` or `DEBIT_NOTE`).

### FR-06: Universal Mutation Idempotency
- All mutation APIs accept `operationId` / `X-Idempotency-Key` to prevent duplicate delivery submissions or double payment settlements.

---

## 3. Non-Functional Requirements (NFR)

### NFR-01: Performance & Throughput
- Sub-50ms API response latency for 95% of route queries.
- Support for 100+ simultaneous concurrent delivery updates without deadlocks or state corruption.

### NFR-02: Security & Defense-in-Depth
- Application Security Firewall (WAF) enforcing rate limiting (10 req/min auth, 60 req/min API), SQLi/XSS pattern filtering, HSTS, CSP, and `X-Frame-Options: DENY`.
- Cryptographic SHA-256 tamper-evident block chain audit log (`AuditBlock`).
