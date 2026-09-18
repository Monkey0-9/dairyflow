# Changelog

All notable changes to MilkFlow 2.0 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-18

### Added
- **Live PostgreSQL Pipeline**: Real database integration testing against Neon Serverless PostgreSQL with 20 relational models and connection pooling.
- **Golden Business Flow E2E**: Comprehensive 18-step end-to-end integration test validating the entire lifecycle from registration, subscription, morning delivery, vacation pause, extra milk, dispute adjustment, itemized billing, webhook processing, to cryptographic SHA-256 audit blockchain verification.
- **Red Team Security Suite**: Automated hostile penetration test suite defending against forged sessions, expired tokens, role escalation, tenant leakage, IDOR, malformed bodies, and replayed webhook attacks.
- **Observability 2.0 Telemetry**: Implemented `/health`, `/ready`, `/live`, and `/metrics` (JSON and Prometheus) endpoints tracking HTTP, DB latency, webhook failures, AI latency, and queue depths.
- **High-Concurrency Stress Testing**: Verified 100 simultaneous concurrent asynchronous operations across deliveries, payments, pause requests, and invoice recalculations with zero deadlocks.
- **Operational Inventory Reconciliation**: Built authoritative dairy balance equation tracking Opening Stock, Production, Purchases, Deliveries, Wastage, Consumption, and Closing Stock with automated variance and root-cause analysis.
- **Advanced Billing Engine**: Added customer statement balance computation (`Opening + Charges + Adjustments - Payments = Closing`), Credit Notes, Debit Notes, and partial payments.
- **Customer 360 Intelligence**: Developed comprehensive Customer 360 API (`/api/customer/360`) aggregating consumption averages, payment history, and churn risk factors.
- **Advanced Farmer Analytics**: Added `/api/analytics/farmer` supporting volume breakdowns by milk type (Cow, Buffalo, A2), collection rate %, dispute rate %, and customer cohorts across today, this week, and this month.
- **Demand Planning Engine**: Connected AI forecasting directly to physical procurement planning (`Procurement = Max(0, Forecast + Safety Stock - Current Inventory - Expected Production)`).
- **Omnichannel Notification Engine**: Created event-driven notification queue fanning out across In-App, WhatsApp, SMS, and Email channels.
- **QR Token Hardening**: Enhanced QR validation ensuring opaque tokens, anti-replay, revocation, and zero customer PII leakage.
- **Documentation Suite**: Added `THREAT_MODEL.md`, `PRIVACY.md`, `DISASTER_RECOVERY.md`, `PILOT_REPORT.md`, `DEPLOYMENT.md`, `TESTING.md`, and `AI_MODEL_CARD.md`.

### Changed
- Refactored `PATCH /api/ledger` to dynamically update database-first records directly in PostgreSQL with in-memory fallback.
- Enhanced `POST /api/webhook/payment` to support native nested Razorpay webhook payloads and settle database-backed invoices idempotently.
- Upgraded `GET /api/invoices/statement` to accept Bearer tokens and look up customer profiles by `invoiceId`.
