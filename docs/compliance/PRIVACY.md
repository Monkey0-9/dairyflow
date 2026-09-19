# MilkFlow 2.0 — Data Privacy, Retention & Compliance Specification

## 1. Scope & Commitment
MilkFlow 2.0 provides multi-tenant digital dairy management services. This document defines our data collection principles, operational usage, retention schedules, data subject rights, and security incident management procedures under applicable data privacy frameworks (including India Digital Personal Data Protection Act - DPDPA and ISO/IEC 27001 principles).

---

## 2. Personal Data Inventory

| Category | Specific Data Points | Purpose of Collection | Access Authorization | Retention Window | Storage Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Identity & Account** | Full Name, Phone Number, Email, Password Hash (scrypt), Salt | Authentication, account recovery, delivery routing | User, Assigned Farmer, Tenant Admin | Active account lifetime + 90 days post-termination | PostgreSQL (`users` table, encrypted at rest) |
| **Delivery Logistics** | Delivery address, doorstep notes, route sequence, delivery time preference | Morning milk drop-off, route optimization | Assigned Farmer & Delivery Agent only | Active subscription lifetime | PostgreSQL (`customer_profiles` table) |
| **Supply Chain Records** | Milk type (Cow, Buffalo, A2), daily quantity, delivery status, bottle return count | Operational fulfillment, inventory tracking | Farmer & Customer | 7 years (Mandatory supply chain & tax compliance) | PostgreSQL (`delivery_records` table) |
| **Financial & Payments** | Invoices, UPI transaction references, paid amounts, payment timestamps | Invoicing, payment reconciliation, tax compliance | Customer, Farmer, Tenant Billing Admin | 8 years (Statutory accounting & GST compliance) | PostgreSQL (`invoices`, `payments` tables) |
| **QR Code Identifiers** | Opaque unguessable UUID token (`MF_QR_...`) | Contactless doorstep delivery confirmation | Farmer scanning camera | Rotated on demand or revoked immediately on account closure | PostgreSQL (`qr_identities` table) |
| **Security Audit Logs** | Actor ID, role, action, IP address, timestamp, SHA-256 block hash | Forensic security audit, tamper detection | SuperAdmin & Compliance Auditor (Read-Only) | Permanent append-only cryptographic audit chain | PostgreSQL (`audit_logs` table) |

---

## 3. Data Protection Safeguards
1. **Zero Customer PII in QR Tokens**: QR codes affixed to customer doorsteps encode ONLY random 48-character hex tokens (`MF_QR_...`). Scanning without active authenticated farmer credentials reveals zero name, phone, or billing details.
2. **Tenant Boundary Cryptography**: All customer records are physically partitioned and logically tagged with immutable `tenant_id` foreign keys. Cross-tenant leakage is systematically blocked by API middleware.
3. **Password Security**: Passwords are never stored in plaintext. They are salted with 16-byte cryptographically secure random salts and hashed via memory-hard `scrypt` (N=16384, r=8, p=1).
4. **Transit & Rest Encryption**: Mandatory TLS 1.3 for all HTTP and Webhook traffic. PostgreSQL storage volumes encrypted with AES-256 at rest.

---

## 4. Data Subject Rights & Workflows
- **Right to Access & Data Portability**: Customers and farmers can export complete itemized consumption and billing history via `/api/invoices/statement` in standard JSON or PDF format.
- **Right to Correction**: Customers can update doorstep delivery notes, contact preferences, and delivery shift timing via `/profile`.
- **Right to Erasure (Account Deletion)**:
  1. Customer requests account deletion via Portal Settings.
  2. Active subscriptions and recurring delivery drops are immediately halted (`status: DEACTIVATED`).
  3. QR token is permanently revoked (`status: REVOKED`).
  4. PII fields (name, phone, delivery address) are anonymized after satisfying statutory tax and ledger retention obligations.

---

## 5. Security Incident Management & Response
1. **Identification**: Automated real-time anomaly detection tracks failed HMAC verifications, rate-limit threshold breaches, and audit chain integrity breaks.
2. **Containment**: Breached session tokens or compromised tenant API keys are immediately revocable via `/api/superadmin/tenants` suspension.
3. **Notification**: In the event of a verified unauthorized data disclosure, affected data fiduciaries and registered users are notified within 72 hours via verified email and SMS channels.
4. **Post-Mortem & Forensic Audit**: Cryptographic SHA-256 audit logs provide mathematical proof of affected records and timeline reconstruction.
