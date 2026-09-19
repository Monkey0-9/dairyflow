/**
 * Move 5: Transactional Accounting Reconciliation Engine.
 * Canonical double-entry equation:
 *   Closing = Opening + Charges + Debits - Credits - Payments
 * All money rounded to 2 decimals (paise) at every step.
 */

export interface StatementInput {
  openingBalance: number;
  charges: number;
  debits: number;
  credits: number;
  payments: number;
}

export interface InvoiceLedgerInput {
  items: Array<{ quantity: number; rate: number }>;
  debits: number;
  credits: number;
  payments: number;
}

export interface ParityInput {
  statement: StatementInput;
  invoiceLedger: InvoiceLedgerInput;
  paymentLogTotal: number;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function reconcileStatement(s: StatementInput): {
  closingBalance: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'OUTSTANDING' | 'OVERPAID';
} {
  for (const [k, v] of Object.entries(s)) {
    if (!Number.isFinite(v)) throw new Error(`Non-finite accounting input ${k}: ${v}`);
  }
  if (s.charges < 0 || s.debits < 0 || s.credits < 0 || s.payments < 0) {
    throw new Error('Charges, debits, credits, payments must be >= 0');
  }
  const closingBalance = round2(s.openingBalance + s.charges + s.debits - s.credits - s.payments);
  let status: 'PAID' | 'PARTIALLY_PAID' | 'OUTSTANDING' | 'OVERPAID' = 'PAID';
  if (closingBalance > 0) status = s.payments > 0 ? 'PARTIALLY_PAID' : 'OUTSTANDING';
  else if (closingBalance < 0) status = 'OVERPAID';
  return { closingBalance, status };
}

export function reconcileInvoiceLedger(l: InvoiceLedgerInput): {
  grossCharges: number;
  netTotal: number;
  outstanding: number;
} {
  const grossCharges = round2(l.items.reduce((s, it) => s + it.quantity * it.rate, 0));
  const netTotal = round2(grossCharges + l.debits - l.credits);
  const outstanding = round2(netTotal - l.payments);
  return { grossCharges, netTotal, outstanding };
}

/**
 * Exact parity across the three books: customer statement closing must equal
 * invoice ledger outstanding, and payment log total must equal ledger payments.
 */
export function verifyLedgerParity(p: ParityInput): {
  parity: boolean;
  statementClosing: number;
  ledgerOutstanding: number;
  paymentDelta: number;
} {
  const st = reconcileStatement(p.statement);
  const ledger = reconcileInvoiceLedger(p.invoiceLedger);
  // Statement charges must equal ledger gross; statement debits/credits/payments mirror ledger.
  const statementClosing = st.closingBalance;
  // Ledger outstanding relative to same opening: outstanding + opening offset
  const ledgerOutstanding = round2(p.statement.openingBalance + ledger.netTotal - p.invoiceLedger.payments);
  const paymentDelta = round2(p.paymentLogTotal - p.invoiceLedger.payments);
  const parity =
    Math.abs(statementClosing - ledgerOutstanding) < 1e-9 && Math.abs(paymentDelta) < 1e-9;
  return { parity, statementClosing, ledgerOutstanding, paymentDelta };
}
