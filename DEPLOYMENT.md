# MilkFlow 2.0 — Production Deployment Guide

## 1. Production Architecture Overview
MilkFlow 2.0 is built on **Next.js 16 (Turbopack, App Router, React 19)**, deployed as a stateless containerized runtime connected to **Neon Serverless PostgreSQL** via pooled TCP connections with SSL verification.

```
                  [ Vercel Edge / Cloudflare CDN ]
                                 │
                                 ▼
                  [ Next.js 16 Production Pods ]
                   ├── HTTP Handlers
                   ├── Server-Sent Events (SSE) Bus
                   └── sliding-window rate limiters
                                 │
                                 ▼
                 [ Neon Serverless PostgreSQL Pool ]
                  (PgBouncer Connection Pooler)
```

---

## 2. Pre-Deployment Configuration
Ensure the following production environment variables are configured in your hosting platform (Vercel, AWS ECS, GCP Cloud Run, or Docker Compose):

```bash
DATABASE_URL="postgresql://<user>:<password>@<pooler-host>/milkflow_prod?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<direct-host>/milkflow_prod?sslmode=require"
SESSION_SECRET="<openssl rand -hex 64>"
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="whsec_..."
NODE_ENV="production"
PORT=3000
```

---

## 3. Deployment Steps

### Step 1: Database Migration
Run database migrations before rolling out new container images:
```bash
npm run prisma:migrate:deploy
# or
npx tsx scripts/migrate.ts
```

### Step 2: Build Production Bundle
```bash
npm run build
```
Verify that all 37+ routes compile cleanly without type or lint errors.

### Step 3: Launch Service & Readiness Verification
```bash
npm run start
```
Verify health endpoints:
```bash
curl -f http://localhost:3000/health
curl -f http://localhost:3000/ready
curl -f http://localhost:3000/live
curl -f http://localhost:3000/metrics
```

---

## 4. Rollback Plan
1. Revert container image tag to previous release (`v1.9.9` or previous git SHA).
2. Database schema changes are strictly backward-compatible (additive only; columns have defaults or are nullable).
3. Verify `/health` and `/ready` probes return HTTP 200 within 15 seconds of rollback.
