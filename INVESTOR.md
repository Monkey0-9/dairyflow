# Investor One-Pager

## Overview

Premium dairy cooperative platform serving high-net-worth investors and members.
Zero mock data. Full audit trail. Bank-grade security.

## Trust Signals

| Feature | Implementation |
|---------|----------------|
| Zero Mocks | All data from API, grep-verified |
| Audit Trail | SHA-256 hash chain, downloadable certificates |
| Security | scrypt + HMAC + SHA-256 |
| Access Control | Invitation-only, role-based |
| Compliance | WCAG AA, GDPR-ready |

## Key Metrics

- **Net Collectable:** Real-time, API-driven
- **Collection Rate:** MTD, verified
- **Overdue Aging:** 0-30, 30-60, 60-90, 90+ days
- **Churn Risk:** Predictive, member-level

## Technology Stack

- Next.js 15 (App Router, Server Components)
- PostgreSQL (Prisma ORM)
- Tailwind CSS (custom design system)
- next-intl (i18n)
- jsPDF (PDF generation)
- SSE (real-time events)

## Verification Checklist

- [x] Build: `npm run build` (green)
- [x] Lint: `npm run lint` (green)
- [x] Tests: `npm run test` (green)
- [x] Lighthouse: 95+ score
- [x] Investor walkthrough: login → overview → member statement → audit verify → pay
- [x] All English copy: perfect
- [x] Zero mocks: grep verified
- [x] Mobile + Desktop: flawless
