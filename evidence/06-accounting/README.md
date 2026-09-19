# Evidence 06 — Accounting

- Engine: `lib/domain/accounting/reconciliation.ts`
  Canonical: Closing = Opening + Charges + Debits − Credits − Payments (paise-rounded).
- Ledger parity: `verifyLedgerParity` proves customer-statement closing ==
  invoice-ledger outstanding and payment-log total == ledger payments.
- Property suite: `tests/unit/accounting-reconciliation-property.ts`
  (1,200 equation permutations + 1,000 ledger-parity permutations, seeded PRNG).
- Service anchor: `recalculateInvoice` (`lib/services/billing.service.ts`),
  `computeStatementBalance`, credit/debit adjustment notes.
- Run: `npx vitest run tests/unit/accounting-reconciliation-property.ts`
