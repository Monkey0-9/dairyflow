# Evidence 09 — Performance & Observability

- Metrics: `lib/observability.ts` (HTTP/DB/webhook/payment/queue/SSE/AI, Prometheus export).
- Tracing: `lib/observability/tracer.ts` — `traceId`/`requestId` from headers →
  route → service → DB → audit log; `traceEvent` couples context to domain events.
- Offline reliability: `lib/services/offline-sync.service.ts` + client queue
  (`lib/offline-sync.ts`); suite `tests/unit/offline-sync.ts`.
- Notification decoupling: `lib/services/notification-outbox.service.ts`
  (QUEUED → PROCESSING → SENT|DELIVERED|FAILED → RETRYING → DEAD_LETTER, backoff).
- Suites: `tests/integration/observability.ts`, `tests/unit/offline-sync.ts`.
- Run: `npx vitest run tests/unit/offline-sync.ts tests/integration/observability.ts`
