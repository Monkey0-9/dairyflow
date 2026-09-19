# Evidence 08 — Chaos & Failure Recovery

Suite: `tests/system/chaos-failure-recovery.ts` (DB-independent fakes + live opt-in).

- Transient dropouts: ECONNRESET retry with exponential backoff commits exactly once;
  exceeding max retries leaves zero partial writes (rollback truncates).
- Mid-transaction failure: orphan invoice impossible — all steps roll back.
- Webhook replay storm: exactly-once credit under 100 concurrent replays.
- Live path (Neon reachable): `executeIdempotentOperation` replay executes once.
- Run: `npx vitest run tests/system/chaos-failure-recovery.ts`
