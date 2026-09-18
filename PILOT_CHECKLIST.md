# MilkFlow 2.0 — Pilot Go-Live Checklist (1 dairy, 1 week soak)

Complete in order. Every step must pass before the next. Owner initials each line.

## 0. Pre-flight (staging)
- [ ] `npm test` → 204/204 green; `npm run build` → 0 type errors, `ƒ Proxy` present.
- [ ] `/api/health` → `HEALTHY`, database `UP` (<2s), outbox `UP`.
- [ ] `DEMO_LOGIN_ENABLED=false` on production; real FARMER + SUPERADMIN seeded via DB.
- [ ] Razorpay test keys: create order → pay → webhook `PROCESSED`; retry same
      `transaction_ref` → `ALREADY_PROCESSED` (no double credit).

## 1. Live payments (₹1 pilot invoice)
- [ ] Flip to `rzp_live_*`; create order → `mode: live`, real `order_*` id.
- [ ] Pay ₹1 via UPI; callback signature verifies; invoice `paidAmount` +1 exactly.
- [ ] Tampered `razorpay_signature` → HTTP 402, ledger untouched.
- [ ] Unsigned webhook in production → HTTP 401.

## 2. Real-time (2 browsers, 2 devices)
- [ ] Customer submits vacation pause → farmer "Needs Attention +1 LIVE" <25s, no refresh.
- [ ] Farmer approves → customer banner + chime <25s.
- [ ] Kill SSE (offline in DevTools) → 20s poll still delivers updates on reconnect.

## 3. Offline field run
- [ ] Airplane mode → mark 3 drops → "Offline Mode Active (3 pending)".
- [ ] Reconnect → auto-sync, server ledger matches, banner confirms count.
- [ ] Two devices edit same record offline → last-write-wins, `clientUpdatedAt` auditable.

## 4. Crons (dry-run first)
- [ ] `GET /api/notifications/remind?dryRun=true` (CRON_SECRET) → counts sane, 0 sends.
- [ ] Remove dryRun → 1 WhatsApp received (HI/MR template renders correctly).
- [ ] `GET /api/cron/monthly-billing?month=&year=` backfill → duplicates skipped via UNIQUE.
- [ ] Vercel → Cron Jobs shows 3 schedules green after 24h.

## 5. Security & suspension
- [ ] Expired/forged session cookie → redirected to `/login` (no access).
- [ ] SuperAdmin `SUSPEND_TENANT` → tenant login blocked (403), API money paths 403.
- [ ] `ACTIVATE_TENANT` → access restored within 60s (cache TTL).
- [ ] 21 rapid logins from one IP → HTTP 429 with `Retry-After`.

## 6. Rollback triggers (any one aborts pilot)
- Double-credit, cross-tenant data leak, webhook 5xx >5 min, Neon pool exhaustion
  (`waitingCount` climbing in `/api/health`). Roll back per DEPLOYMENT.md §4.

## Sign-off
Pilot dairy: ______________  Farmer: ______________  Dates: ______ → ______
Eng owner: ______________  SuperAdmin: ______________
