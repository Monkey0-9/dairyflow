# MilkFlow 2.0 — Relational Database Specification

## Overview

The authoritative database is hosted on **PostgreSQL (Neon Serverless)** with connection pooling and SSL encryption. The schema encompasses 20 tables with foreign key cascades, unique composite constraints, and performance indexes.

---

## Entity Relationship Summary

```
                      tenants
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
      users           products       audit_blocks
        │                │
   ┌────┴────┐           │
   ▼         ▼           │
farmer    customer ◄─────┼────── subscriptions
   │         │           │             │
   │         ├─── pause_requests       │
   │         ├─── extra_requests       │
   │         ├─── qty_requests         │
   │         ├─── disputes             │
   │         ├─── invoices ◄───────────┘
   │         │        │
   │         │        ├── invoice_items
   │         │        └── payments
   │         │
   │         └─── delivery_records ◄── products
   │
   ├── inventory_records
   └── day_closings
```

---

## Critical Constraints & Invariants

### 1. Invoice Uniqueness
```sql
UNIQUE(customer_id, month, year)
```
Guarantees that a customer can never be billed twice for the same billing cycle.

### 2. Payment Idempotency
```sql
UNIQUE(transaction_ref)
```
Guarantees that webhook retries or duplicate payment submissions do not double credit customer balances or double charge invoices.

### 3. Delivery Record Uniqueness
```sql
UNIQUE(customer_id, date, product_id)
```
Guarantees one definitive delivery state per customer, date, and milk product.

### 4. Day Closing Lock
```sql
UNIQUE(farmer_id, date)
```
Locks delivery adjustments for a date once the day closing status transitions to `FINALIZED`.

### 5. Multi-Tenant Scoping
Every core business entity (`users`, `farmer_profiles`, `customer_profiles`, `products`, `delivery_records`, `invoices`, `payments`, `audit_blocks`) possesses a mandatory `tenant_id` foreign key referencing `tenants(id)`.
