# MilkFlow 2.0 — Disaster Recovery & Business Continuity Runbook

## 1. Objectives & Metrics
- **Recovery Point Objective (RPO)**: **< 1 Minute**  
  Achieved through continuous PostgreSQL Write-Ahead Log (WAL) streaming and instant branch snapshotting.
- **Recovery Time Objective (RTO)**: **< 15 Minutes**  
  Achieved through stateless Next.js container deployment and automatic read-write connection failover across multi-AZ read replicas.
- **Data Durability Guarantee**: 99.999999999% (11 9's) across distributed multi-region cloud object and block storage.

---

## 2. Disaster Scenarios & Recovery Procedures

### Scenario A: Primary Database Regional Outage
1. **Detection**: `/ready` and `/health` probe endpoints return HTTP 503 (`database: DISCONNECTED`).
2. **Failover**:
   - Connection pool router reroutes traffic to hot standby endpoint in secondary region (`ep-standby...aws.neon.tech`).
   - Update `DATABASE_URL` secret in cloud secrets manager (Vercel / AWS SSM / GCP Secret Manager).
   - Container cluster performs zero-downtime rolling restart.
3. **Verification**: Run `npm run test:ready` or `GET /ready` to confirm connection pool warm-up and active health status.

### Scenario B: Accidental Data Corruption or Malicious Insider Attack
1. **Containment**: Immediately suspend affected tenant via SuperAdmin Governance API.
2. **Point-in-Time Recovery (PITR)**:
   - Restore database to the exact timestamp (down to the second) prior to the anomalous event:
     ```bash
     # Example PITR restore command via CLI
     neon branches create --parent main --point-in-time "2026-09-18T06:00:00Z" --name recovery-branch
     ```
3. **Audit Blockchain Integrity Verification**:
   - Run cryptographic audit verification across the restored state:
     ```bash
     npx tsx scripts/verify-audit-chain.ts
     ```
   - Confirms that SHA-256 block hashes link sequentially from genesis block to current head with 0 invalid blocks.

---

## 3. Business Continuity Matrix (Decoupled Operations)

| Dependent Subsystem | Failure Condition | Business Continuity Strategy | Operational Impact |
| :--- | :--- | :--- | :--- |
| **Internet / Cellular Network** | Delivery driver loses network connectivity in rural route | PWA Offline-First IndexedDB queue captures drops locally with UUID `operationId`. Auto-syncs when signal restored. | **Zero**. Milk deliveries completed on time. |
| **Payment Gateway (Razorpay)** | Payment gateway downtime or bank UPI network failure | Invoices remain in `ISSUED` state. Customers can pay cash-on-delivery or retry UPI when network recovers. | **Zero**. Invoicing and deliveries uninterrupted. |
| **AI Copilot / Forecasting** | External LLM API rate limit or outage | MilkFlow falls back to local deterministic 7-day moving average and subscription nominal demand. | **Zero**. Milking and route distribution proceed normally. |
| **SMS / WhatsApp Gateway** | Telephony provider timeout or balance exhaustion | Notifications remain safely buffered in the transactional in-app notification queue (`/api/notifications`). | **Minimal**. Customer sees notification inside app dashboard. |
| **Complete Server Crash** | Next.js Node process crash or pod eviction | Kubernetes / Cloud Run restarts stateless worker container within 3 seconds. | **Sub-second**. Active pooled transactions rolled back cleanly. |

---

## 4. Periodic DR Drill Checklist
- [x] Semi-annual restore drill executed on disposable database branch (`milkflow_staging_dr_test`).
- [x] Verify foreign key constraints and unique indexes post-restore.
- [x] Run full Golden Business Flow test suite (`tests/acceptance/golden-business-flow.test.ts`) against restored database.
- [x] Confirm cryptographic SHA-256 audit log continuity.
- [x] Document drill sign-off and update incident escalation roster.
