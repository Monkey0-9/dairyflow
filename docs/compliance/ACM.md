# Access Control Matrix (ACM) & Role Governance Specification

## Executive Overview
MilkFlow implements a zero-trust multi-tenant Role-Based Access Control (RBAC) architecture with 7 distinct user roles:

1. **OWNER**: Dairy business proprietor (full operational & financial control).
2. **MANAGER**: Operational supervisor (routes, delivery approvals, adjustments).
3. **DELIVERY_AGENT**: Route executor (route delivery marking, QR verification).
4. **ACCOUNTANT**: Financial auditor (invoices, payments, statement reconciliation).
5. **SUPPORT**: Customer care agent (triage disputes, view customer history).
6. **CUSTOMER**: Dairy client (portal view, self-profile edit, request submission, payments).
7. **SUPERADMIN**: Platform administrator (multi-tenant management).

---

## 1. Access Control Matrix (ACM)

| Resource / Action | OWNER | MANAGER | DELIVERY_AGENT | ACCOUNTANT | SUPPORT | CUSTOMER | SUPERADMIN |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Create Customer Record** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Activate Customer Account** | ❌ | ❌ | ❌ | ❌ | ❌ | Self-Only | ❌ |
| **Edit Customer Profile (Personal)** | ✅ | ✅ | ❌ | ❌ | ❌ | Self-Only | ✅ |
| **Edit Customer Parameters (Tenant/Farmer/Subscription)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Transfer Customer Ownership** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **View Route & Delivery Schedule** | ✅ | ✅ | Assigned | ❌ | ❌ | Self-Only | ✅ |
| **Mark Delivery Status (Delivered/Skipped)** | ✅ | ✅ | Assigned | ❌ | ❌ | ❌ | ✅ |
| **Day Closing Finalization** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Delivery Correction Request** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Generate Invoices** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Issue Credit / Debit Note Adjustments** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Process Payment & Gateway Replays** | ✅ | ❌ | ❌ | ✅ | ❌ | Self-Only | ✅ |
| **View Audit Logs (SHA-256 Chain)** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **System Settings & Business Profile** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 2. Authentication & Session Security Envariants

1. **Session Encoding**: Cryptographically signed HMAC-SHA256 tokens (`milkflow_session` cookie).
2. **HttpOnly Cookie**: Prevents JavaScript XSS access to primary session tokens.
3. **Immutability Invariant**: `tenantId`, `farmerId`, and `customerId` bound to session token server-side. Request body parameters attempting cross-tenant injection are ignored.
