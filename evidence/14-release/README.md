# Evidence 14 — Release (Level 5 Verification Plan)

Execute in order; DB-backed assertions self-skip without Neon, pure proofs always run.

```bash
npx vitest run tests/unit/domain-invariants-engine.ts
npx vitest run tests/security/database-constraints.ts
npx vitest run tests/security/multi-tenant-penetration.ts
npx vitest run tests/unit/accounting-reconciliation-property.ts
npx vitest run tests/unit/property-based-domain.ts
npx vitest run tests/system/chaos-failure-recovery.ts
npx vitest run tests/unit/offline-sync.ts
npx vitest run tests/security/ tests/unit/ tests/system/chaos-failure-recovery.ts
```

Classification (per PRODUCTION_ASSURANCE_AUDIT.md §2):
IMPLEMENTED → TESTED → INTEGRATION TESTED → ADVERSARIAL TESTED → PRODUCTION VERIFIED.
New Level 5 artifacts in this release: invariant engine (11 validators + runner),
24 CHECK constraints, penetration suite, reconciliation engine (2,200 permutations),
property suite (3,000+ configs), chaos suite, offline-sync service, tracer,
notification outbox, this evidence package.
