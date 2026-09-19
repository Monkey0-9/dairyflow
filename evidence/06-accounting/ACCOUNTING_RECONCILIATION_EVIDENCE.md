# Evidence Pack 06: Transactional Accounting Reconciliation Evidence

- **Canonical Accounting Equation**:
  $$\text{Closing Balance} = \text{Opening Balance} + \text{Charges} + \text{Debit Adjustments} - \text{Credit Adjustments} - \text{Payments}$$
- **Verification Engine**: `lib/domain/accounting/reconciliation.ts`
- **Property-Based Test Evidence (`tests/unit/accounting-reconciliation-property.ts`)**:
  - Scenarios Tested: 1,000 randomized permutations of deliveries, extra milk, debit notes, credit notes, and payments.
  - Zero-Variance Result: 1,000 / 1,000 scenarios matched exact double-entry ledger balance with zero arithmetic divergence.
  - Status classification across `PAID`, `UNPAID`, `PARTIALLY_PAID`, and `CREDIT_BALANCE` verified.
