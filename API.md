# MilkFlow 2.0 — API Reference

All API routes are located under `/api/*` and return standard JSON responses.

---

## Authentication Endpoints

### `POST /api/auth/login`
Authenticates user credentials and issues a signed session cookie.

**Request Body (Option A - Credentials):**
```json
{
  "phone": "+919123456780",
  "password": "Customer@2026!"
}
```

**Request Body (Option B - 1-Tap Demo Switcher):**
```json
{
  "demoUserId": "user_farmer"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "userId": "user_farmer",
    "name": "Suresh Patel",
    "role": "FARMER",
    "tenantId": "tenant_greenvalley"
  },
  "redirectUrl": "/admin"
}
```

---

### `POST /api/auth/register`
Creates a new customer account, customer profile, and assigns the customer to a specific farmer and subscription.

**Request Body:**
```json
{
  "name": "Ravi Kumar",
  "phone": "+919123456780",
  "address": "B-204, Shanti Heights, Pune",
  "productId": "PROD_COW_GV",
  "quantity": 1.0,
  "deliveryShift": "MORNING"
}
```

---

## Delivery & Ledger Endpoints

### `GET /api/ledger`
Retrieves daily or batch date-range delivery records.

**Query Parameters:**
- `date`: Single date (e.g. `2026-09-17`)
- `from` & `to`: **Batch date range query** (e.g. `from=2026-09-01&to=2026-09-30`) — *Eliminates N+1 calendar loops*
- `customerId`: Filter by customer

---

### `PATCH /api/ledger`
Updates delivery record for a customer on a given date.

**Request Body:**
```json
{
  "recordId": "DEL_RAVI_17",
  "deliveredQuantity": 1.0,
  "status": "DELIVERED",
  "notes": "Delivered in morning drop",
  "bottlesReturned": 1
}
```

---

## Request & Synchronization Endpoints

### `POST /api/customer/pause-request`
Customer schedules a vacation pause.

**Request Body:**
```json
{
  "startDate": "2026-09-20",
  "endDate": "2026-09-25",
  "reason": "Family visiting native village"
}
```

---

### `PATCH /api/farmer/requests/[id]`
Farmer approves or rejects a customer request.

**Request Body:**
```json
{
  "action": "APPROVED",
  "type": "PAUSE"
}
```

---

## Payments & Webhook Endpoints

### `POST /api/webhook/payment`
Payment gateway webhook notification.

**Headers:**
- `x-razorpay-signature`: HMAC-SHA256 signature

**Request Body:**
```json
{
  "transactionRef": "UPI_TXN_9876543210",
  "invoiceId": "INV_RAVI_SEP_2026",
  "amount": "1500",
  "paymentMethod": "UPI",
  "note": "Payment via PhonePe"
}
```

---

## SuperAdmin Platform Endpoints

### `GET /api/superadmin`
Returns global platform telemetry across all tenants:
- `kpis`: Total Platform GMV, total volume in liters, active tenants, active farmers, system health.
- `tenants`: Multi-tenant organization list with active status and customer metrics.
- `farmers`: Dairy farmers directory with route codes and assigned customer totals.
- `customers`: Global cross-tenant customer registry.
- `auditStatus`: Mathematical verification status of the SHA-256 blockchain.
