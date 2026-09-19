# 🥛 MilkFlow - Farmer Operations User Guide

Welcome to **MilkFlow**, your simplified, daily milk delivery management system! This guide provides simple, step-by-step instructions for managing your dairy business, daily deliveries, customer billing, and payment tracking.

---

## 📋 Table of Contents
1. [Logging In to Your Account](#1-logging-in-to-your-account)
2. [Daily Milk Delivery Ledger](#2-daily-milk-delivery-ledger)
3. [Managing Customer Requests](#3-managing-customer-requests)
4. [Recording Customer Payments](#4-recording-customer-payments)
5. [Monthly Statements & Invoicing](#5-monthly-statements--invoicing)
6. [Customer Onboarding & Invitations](#6-customer-onboarding--invitations)

---

## 1. Logging In to Your Account

1. Open your browser and navigate to your MilkFlow web application domain (e.g. `https://your-domain.vercel.app/login`).
2. Enter your registered **Email or Phone Number** and your **Password**.
3. Select **Farmer / Admin Login**.
4. Once authenticated, you will be taken to your **Farmer Admin Dashboard** (`/admin`).

---

## 2. Daily Milk Delivery Ledger

The **Daily Ledger** (`/admin/ledger`) is where you record and update milk deliveries for each customer on a daily basis.

### ☀️ Morning & Evening Delivery Marking
1. Go to **Admin Dashboard -> Daily Ledger**.
2. Select the **Date** (defaults to today).
3. Review your customer list for the shift.
4. For each customer:
   - **Delivered**: Tap **Delivered** if the exact scheduled quantity was delivered.
   - **Partial**: Tap **Partial** and enter the actual litres delivered (e.g., `1.5 L` instead of `2.0 L`).
   - **Skipped / Absent**: Tap **Skipped** if the customer asked not to receive milk today or was absent.
   - **Bottles Returned**: Enter the number of empty glass bottles returned.
5. Tap **Save Ledger** or **Update Record**. Changes update customer balances in real-time.

---

## 3. Managing Customer Requests

Customers can submit requests directly from their customer portal (`/customer`). You can view and action these under **Pending Requests** in your Admin Dashboard.

### 🏖️ Pause Requests (Vacations)
- When a customer marks themselves on vacation, you will see a pending pause request with start and end dates.
- Tap **Approve** to automatically exclude them from the daily delivery ledger during those dates.
- Tap **Reject** if the notice was given too late or after milk dispatch.

### 🥛 Extra Milk Requests
- If a customer requests extra litres for a specific date (e.g., `+2.0 L` for a family function), approve the request to automatically update their scheduled quantity on that day's ledger.

---

## 4. Recording Customer Payments

MilkFlow uses a **simplified manual payment recording** system so you can easily record cash, UPI (Google Pay, PhonePe, Paytm), or direct bank transfers.

### 💵 How to Record a Payment
1. Go to **Admin Dashboard -> Customers / Billing**.
2. Search or select the **Customer Name**.
3. Click **Record Payment**.
4. Enter:
   - **Amount Paid (₹)**: e.g., `₹1,500`
   - **Payment Method**: Cash, UPI, or Direct Transfer
   - **Reference / Notes**: e.g., `UPI Ref 938472910` or `Cash handed during delivery`
5. Click **Confirm Payment**. The invoice outstanding balance and customer account status update immediately.

---

## 5. Monthly Statements & Invoicing

At the end of each calendar month, MilkFlow compiles all daily delivery records into monthly statements.

1. Navigate to **Billing & Invoices**.
2. Select the **Month & Year** (e.g., `September 2026`).
3. Click **Generate Monthly Invoices**.
4. You can download or send digital statements to customers via WhatsApp or SMS.
5. Invoices show:
   - Total litres delivered
   - Rate per litre
   - Any discounts or adjustments
   - Payments received
   - Final outstanding balance due

---

## 6. Customer Onboarding & Invitations

To add a new customer to your milk route:

1. Go to **Customers -> Add New Customer**.
2. Fill in:
   - Customer Full Name
   - Phone Number & Address
   - Default Daily Quantity (e.g., `1.5 L`) & Milk Type (Cow / Buffalo / Organic)
   - Route Code (e.g., `ROUTE-1`)
3. Click **Save & Send Invite**.
4. A secure registration link is generated for the customer to set their password and view their daily delivery dashboard.

---

*Need help? Refer to the [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md) or contact system support.*
