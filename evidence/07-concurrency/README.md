# Evidence 07 — Concurrency

- Transactional primitives: `transaction()` + `SELECT FOR UPDATE` day-closing locks,
  `ON CONFLICT DO NOTHING` idempotency inserts, UNIQUE guards.
- Replay-storm proof: `tests/system/chaos-failure-recovery.ts`
  (100-way concurrent webhook replay collapses to one credit; serialized
  replay executes exactly once; live `executeIdempotentOperation` replay test
  when Neon reachable).
- Load coverage: `tests/system/concurrency-load-recovery.ts`.
- Run: `npx vitest run tests/system/chaos-failure-recovery.ts tests/system/concurrency-load-recovery.ts`
