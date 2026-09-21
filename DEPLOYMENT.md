# MilkFlow — Production Deployment & Operations Guide

This guide provides end-to-end instructions for deploying MilkFlow to production on any cloud platform (**Vercel**, **Railway**, **Render**, **Fly.io**, **Docker/VPS**, or **Google Cloud Run**).

---

## 1. Environment Variables Configuration

Create a `.env` or set these environment variables in your hosting provider's dashboard:

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Neon Serverless PostgreSQL connection string | **Yes** | `postgresql://neondb_owner:...@ep-....neon.tech/neondb?sslmode=require` |
| `SESSION_SECRET` | 32-byte secret for HMAC session signing | **Yes** | `e2a4f6...` (generate via `openssl rand -hex 32`) |
| `NODE_ENV` | Application environment | **Yes** | `production` |
| `PORT` | Server port (default 3000) | No | `3000` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (caching & locks) | Recommended | `https://...upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | Recommended | `AXXX...` |
| `SENDGRID_API_KEY` | SendGrid API Key for Transactional Emails | Optional | `SG....` (Defaults to reliable sandbox) |
| `RESEND_API_KEY` | Resend API Key for Transactional Emails | Optional | `re_....` (Defaults to reliable sandbox) |
| `FROM_EMAIL` | Verified Sender Email Address | Optional | `orders@dairyflow.app` |
| `RAZORPAY_KEY_ID` | Razorpay Gateway Key ID | Optional | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Gateway Secret | Optional | `...` |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook Signing Secret | Optional | `...` |

---

## 2. Fast Deployment Options

### Option A: Vercel (Recommended for Next.js)

1. Push code to GitHub: `git push origin main`
2. Import the repository into [Vercel](https://vercel.com).
3. Set the Environment Variables (`DATABASE_URL`, `SESSION_SECRET`).
4. Click **Deploy**.
5. After deployment, run one-time database setup (see Section 3).

### Option B: Docker Container (Railway, Render, Fly.io, Cloud Run)

The repository includes a production multi-stage `Dockerfile` with standalone output:

```bash
# Build production Docker image
docker build -t milkflow:latest .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://neondb_owner:...@ep-....neon.tech/neondb?sslmode=require" \
  -e SESSION_SECRET="your-32-byte-hex-secret" \
  milkflow:latest
```

### Option C: Linux VPS (Ubuntu / Debian / systemd / PM2)

```bash
# 1. Clone repo
git clone https://github.com/Monkey0-9/dairyflow.git /var/www/milkflow
cd /var/www/milkflow

# 2. Install dependencies & build
npm ci
npm run build

# 3. Start with PM2
pm2 start npm --name "milkflow" -- start
pm2 save
pm2 startup
```

---

## 3. Database Initialization & Admin Setup

Run these commands once against your production database:

```bash
# 1. Apply all 16 PostgreSQL schema DDL tables (including delivery_corrections)
npx tsx scripts/migrate.ts

# 2. Seed SuperAdmin and Farmer credentials
npx tsx scripts/upsert-admin.ts
```

### Default Seed Credentials

- **SuperAdmin**: `prakashpraveen046@gmail.com` / `Abc@1234` (Redirects to `/superadmin`)
- **Farmer / Admin**: `prakashpraveen239@gmail.com` / `Abc@1234` (Redirects to `/admin`)

---

## 4. Verification & Automated Testing

```bash
# Run 55 Vitest test suites (306 tests - 100% passing)
npm run test

# Run Playwright End-to-End browser tests (Chromium)
npm run test:e2e

# Run all test suites together
npm run test:all
```

---

## 5. Health, Operations & API Endpoints

- **Live Application Health**: `GET /api/health`
- **Kubernetes / Container Liveness Probe**: `GET /live`
- **Kubernetes / Container Readiness Probe**: `GET /ready`
- **Prometheus Metrics**: `GET /metrics`
- **Delivery Corrections Audit Engine**: `GET /api/delivery-corrections`, `POST /api/delivery-corrections`
- **Interactive Route Map & GPS Circuit**: Available in Farmer Console (`/admin` -> Route View)
