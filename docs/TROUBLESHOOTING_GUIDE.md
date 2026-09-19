# 🛠️ MilkFlow - Operator & Farmer Troubleshooting Guide

This guide covers resolution steps for common operational issues, login problems, payment reconciliation discrepancies, and database connectivity.

---

## 🔍 Quick Diagnostic Matrix

| Issue Symptom | Probable Cause | Immediate Fix |
| :--- | :--- | :--- |
| **Login fails with "Invalid credentials"** | Incorrect email/phone or inactive customer account | Check account status in Admin -> Customers; verify user role. |
| **Webhook 404 error** | Obsolete payment webhook route requested | Ensure payment endpoints target `/api/webhook/payment` or manual recording. |
| **Daily Ledger shows no customers** | No active subscriptions for current route/date | Verify customer active status and subscription start dates. |
| **Database error on save** | Neon PostgreSQL connection timeout or constraint error | Check `DATABASE_URL` environment variable; verify migration status. |
| **Customer invitation link expired** | 48-hour invitation token window elapsed | Generate a new invite link from Admin -> Customer -> Reset Invite. |

---

## 1. Authentication & Session Issues

### ❌ Problem: Customer or Farmer cannot log in
**Steps to resolve:**
1. Verify `JWT_SECRET` is set in `.env` (or `.env.local`).
2. Ensure cookies are enabled in the user's browser. MilkFlow uses secure HttpOnly session cookies (`milkflow_session`).
3. If using single-sign-on or demo credentials, ensure `ENABLE_DEMO_LOGIN` is set appropriately for your environment.

---

## 2. Delivery Ledger Discrepancies

### ❌ Problem: Customer says milk was marked delivered when they were on vacation
**Steps to resolve:**
1. Check **Pause Requests** in Admin Dashboard to confirm if the vacation request was approved prior to ledger generation.
2. If unapproved, approve the request and navigate to the Daily Ledger for the disputed date.
3. Change the delivery status for that date from `DELIVERED` to `SKIPPED`. The system automatically updates the billable amount to `₹0.00`.

### ❌ Problem: Unable to edit a past ledger record (Error 423 / Finalized)
**Explanation:** If a day or month closing has been finalized (`FINALIZED` status in `day_closings`), historical records are locked to maintain financial auditability.
**Fix:** Perform an **Authorized Invoice Adjustment** under `Admin -> Billing -> Adjustments` rather than altering closed ledger entries directly.

---

## 3. Payment Reconciliation

### ❌ Problem: Manual payment recorded with incorrect amount or customer
**Steps to resolve:**
1. Go to `Admin -> Customer Profile -> Payment History`.
2. Locate the payment entry.
3. Use **Adjustment / Correction** to record a counter-adjustment or update the transaction reference.
4. Verify the net outstanding balance on the customer's monthly statement.

---

## 4. Database & Connection Failures

### ❌ Problem: "Database connection failed. Please check DATABASE_URL"
**Steps to resolve:**
1. Verify your `DATABASE_URL` in `.env.production` includes sslmode parameters (e.g. `postgres://user:pass@ep-cool-name.neon.tech/neondb?sslmode=require`).
2. Test connection from terminal:
   ```bash
   npx tsx scripts/migrate.ts
   ```
3. If using serverless connection pooling, ensure pooling URL is used (`-pooler` suffix in Neon hostnames).

---

*For technical escalations, check application server logs or consult the [Database Setup Guide](DATABASE_SETUP.md).*
