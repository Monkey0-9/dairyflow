# Evidence 05 — Business Invariants

Engine: `lib/domain/invariants/` (11 validators + `index.ts` unified runner).

| Invariant | Module | Test |
|---|---|---|
| Customer ownership | CustomerOwnershipInvariant.ts | domain-invariants-engine.ts |
| Tenant isolation cascade | TenantIsolationInvariant.ts | domain-invariants-engine.ts, multi-tenant-penetration.ts |
| Subscription non-overlap | SubscriptionOverlapInvariant.ts | property-based-domain.ts, domain-invariants-engine.ts |
| Price non-overlap + >= 0 | PriceOverlapInvariant.ts | property-based-domain.ts |
| Delivery FSM | DeliveryStateInvariant.ts | property-based-domain.ts |
| Closed day lock | ClosedDayInvariant.ts | domain-invariants-engine.ts |
| Closed month lock | ClosedMonthInvariant.ts | domain-invariants-engine.ts |
| Invoice immutability | InvoiceImmutabilityInvariant.ts | property-based-domain.ts |
| Payment idempotency | PaymentIdempotencyInvariant.ts | chaos-failure-recovery.ts |
| Inventory balance | InventoryBalanceInvariant.ts | property-based-domain.ts |
| Audit hash chain | AuditContinuityInvariant.ts | domain-invariants-engine.ts |

- Runner semantics: `runInvariants` (short-circuit) + `runAllInvariants` (full audit report).
- Randomized proofs: `tests/unit/property-based-domain.ts` (3,000+ configurations).
- Run: `npx vitest run tests/unit/domain-invariants-engine.ts tests/unit/property-based-domain.ts`
