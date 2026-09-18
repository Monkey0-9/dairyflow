# MilkFlow 2.0 — Enterprise Architecture Specification

## 1. System Topology

MilkFlow 2.0 is structured into four primary tiers:

```
┌─────────────────────────────────────────────────────────────┐
│                       PRESENTATION TIER                     │
│  - Customer Portal (/customer)                              │
│  - Farmer / Dairy Admin Portal (/admin)                     │
│  - SuperAdmin Platform Command Center (/superadmin)         │
│  - Public Authentication & Landing Pages (/, /login)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    API & AUTHORIZATION GATE                 │
│  - Edge / Node.js Next.js App Router Middleware             │
│  - Cryptographic Session Verification (HMAC-SHA256)         │
│  - Role Enforcement (CUSTOMER, FARMER, ADMIN, SUPERADMIN)   │
│  - Multi-Tenant Scoping (tenant_id)                         │
│  - Resource Ownership Checks (customer_id, farmer_id)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      DOMAIN SERVICES TIER                   │
│  - CustomerService (Profile & Identity Management)          │
│  - DeliveryService (Ledger Engine, Route View, Batch Query) │
│  - RequestService (Vacation, Extra Milk, Quantity Change)   │
│  - BillingService (Price Locking, Invoicing Invariants)     │
│  - PaymentService (Idempotency Engine, Gateway Validation)  │
│  - AuditService (SHA-256 Tamper-Evident Hash Blockchain)    │
│  - SuperAdminService (Platform Analytics & Tenant Health)   │
│  - AIForecastingService (Statistical Backtesting & Buffer)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     DATA PERSISTENCE TIER                   │
│  - Neon Serverless PostgreSQL Database                      │
│  - Prisma 8 Contract & Relational Schema                    │
│  - Node.js Connection Pool with Serverless Optimization     │
│  - Strict Composite Constraints (Unique Invoices, Txn Refs) │
└─────────────────────────────────────────────────────────────┘
```

## 2. Customer ↔ Farmer Relationship

Unlike single-tenant prototypes where customers maintain unlinked states, MilkFlow 2.0 enforces an authoritative relational graph:

```
Tenant
 └── FarmerProfile (e.g. Suresh Patel - F001)
      │
      ├── CustomerProfile (Ravi Kumar - cust_ravi)
      │    ├── Subscriptions (1.0 L Cow Milk)
      │    ├── Delivery Records (September Ledger)
      │    ├── Pause Requests (Vacation)
      │    ├── Extra Milk Requests
      │    ├── Invoices & Payments
      │    └── Disputes
      │
      └── CustomerProfile (Priya Sharma - cust_priya)
           └── ...
```

## 3. Request-Approval Synchronization Lifecycle

Requests submitted by customers do not silently mutate production delivery state. They follow a formal finite-state machine (FSM):

```
[CUSTOMER ACTION]
Submit Pause / Extra Milk Request
       │
       ▼
[DATABASE]
State: PENDING
       │
       ▼
[FARMER ACTION]
Farmer views Needs Attention Center
       │
       ├── APPROVE ───────────────────────┐
       │                                  │
       ▼                                  ▼
[DATABASE MUTATION]              [CUSTOMER NOTIFIED]
- Pause: Set Ledger to SKIPPED   - Notification added
- Extra: Set Ledger to EXTRA     - Status updated in Portal
- Quantity: Update Subscription  - SHA-256 Block logged
```
