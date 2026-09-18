# MilkFlow 2.0 — Production Deployment Guide (Vercel + Neon)

## 1. Production Architecture

Next.js 16 (Turbopack, App Router, React 19) on **Vercel Serverless Functions**,
**Neon Serverless PostgreSQL** via the pooled connection string, **Upstash Redis**
for cross-instance real-time fan-out, **Razorpay** for payments, **Meta WhatsApp
Cloud API** (+ SMS fallback) for reminders, and **Vercel Cron** for scheduled jobs.

```
[ Farmers / Customers (PWA) ]
              │
              ▼
[ Vercel: Next.js 16 + proxy.ts gates + security headers + rate limits ]
   ├── Route handlers (DB-first, store fallback in tests)
   ├── SSE + 20s cross-instance poll (Upstash outbox)
   └── Vercel Cron: monthly-billing / daily-check / notifications:remind
              │
              ▼
[ Neon PostgreSQL (POOLER url) ]   [ Upstash Redis ]   [ Razorpay / Meta / SMS ]
```

Serverless constraints applied in code: `pg` pool `PG_POOL_MAX=3` with fast
recycle + statement timeout (`lib/db.ts`), in-process event bus backed by the
Redis outbox (`lib/events.ts`), per-IP sliding-window rate limits on
auth/payment/webhook/order routes.

## 2. Environment Variables (Vercel → Project → Settings → Environment)

```bash
# Database (Neon POOLER host for DATABASE_URL; direct host for DIRECT_URL)
DATABASE_URL="postgresql://<user>:<password>@<pooler-host>/milkflow_prod?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<direct-host>/milkflow_prod?sslmode=require"
PG_POOL_MAX="3"

# Auth
SESSION_SECRET="<openssl rand -hex 64>"   # required in production, boot fails without it
DEMO_LOGIN_ENABLED="false"                # disable 1-tap demo logins after seeding a real admin

# Payments (live)
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="whsec_..."

# Real-time fan-out (both required for multi-instance SSE catch-up)
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."

# Notifications
NOTIFY_PROVIDER="auto"                    # auto | whatsapp | sms | off
WHATSAPP_PROVIDER_KEY="<meta-cloud-api-token>"
WA_PHONE_NUMBER_ID="<meta-phone-number-id>"
WA_TEMPLATE_NAME="<approved-utility-template>"  # optional; text mode inside 24h window
WA_TEMPLATE_LANG="en"
SMS_API_URL=""                            # generic JSON POST { to, message }
SMS_PROVIDER_KEY="..."
SMS_API_KEY_HEADER="Authorization"

# Crons (Vercel sends this as Authorization: Bearer automatically)
CRON_SECRET="<openssl rand -hex 32>"

NODE_ENV="production"
```

See `.env.example` for the full template.

## 3. Deploy Steps

### Step 1: Database
```bash
npx tsx scripts/migrate.ts     # raw-SQL schema (20 tables)
npx tsx scripts/seed.ts        # seed demo tenant (staging only — never production customer data)
```

### Step 2: Vercel project
```bash
vercel link
vercel env pull .env.local   # sanity-check parity, never commit
git push origin main         # CI: lint → test (204) → build → preview/production deploy
```
`vercel.json` registers three crons (all UTC): `monthly-billing` (1st, 02:30),
`daily-check` (22:00), `notifications/remind` sender (22:15).

### Step 3: Verify
```bash
curl -f https://<app>.vercel.app/api/health
```
Expect `HEALTHY`, `database.UP`, `realtimeOutbox.UP`. Then run
`PILOT_CHECKLIST.md` end-to-end (₹1 live payment, pause→approve SSE,
offline queue drain, cron dry-runs).

## 4. Rollback
1. Vercel → Deployments → Promote previous production deployment (instant).
2. Schema changes are additive-only (nullable columns/defaults); no down-migration needed.
3. If a bad cron run double-bills: invoices are `UNIQUE(customer,month,year)` and
   payments idempotent on `transaction_ref` — reruns are safe; void via SuperAdmin
   dispute flow, never raw SQL deletes.
4. Rotate `CRON_SECRET`/provider keys if a runaway sender is suspected, then
   `NOTIFY_PROVIDER=off` as a kill-switch (redeploy, no code change).
