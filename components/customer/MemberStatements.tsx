'use client';

import React, { useState } from 'react';
import { Invoice, Payment } from '@/lib/types';
import { StatementTable, StatementItem } from '@/components/ui/StatementTable';
import { Card } from '@/components/ui/Card';
import { CreditCard, FileCheck, ShieldCheck } from 'lucide-react';

interface MemberStatementsProps {
  invoices: Invoice[];
  payments: Payment[];
  onViewInvoice: (invoice: Invoice) => void;
  onPayInvoice: (invoice: Invoice) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  isLoading?: boolean;
}

export function MemberStatements({
  invoices,
  payments,
  onViewInvoice,
  onPayInvoice,
  onDownloadPdf,
  isLoading = false,
}: MemberStatementsProps) {
  const [nowMs] = useState(() => Date.now());

  // Map invoices into StatementItem format
  const statementItems: StatementItem[] = invoices.map((inv) => {
    const isPaid = inv.status === 'PAID' || inv.paidAmount >= inv.totalAmount;
    const isOverdue = inv.status === 'OVERDUE' || (!isPaid && new Date(inv.dueDate).getTime() < nowMs);
    const isPartial = inv.paidAmount > 0 && inv.paidAmount < inv.totalAmount;
    const pendingPayment = payments.find(
      (p) => p.invoiceId === inv.id && p.status === 'PENDING'
    );
    const isVerifying = !isPaid && !!pendingPayment;

    let status: StatementItem['status'] = 'PENDING';
    if (isPaid) status = 'PAID';
    else if (isVerifying) status = 'VERIFYING';
    else if (isOverdue) status = 'OVERDUE';
    else if (isPartial) status = 'PARTIAL';

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const periodStr = `${monthNames[(inv.month || 1) - 1]} ${inv.year || new Date().getFullYear()}`;

    return {
      id: inv.id,
      statementNumber: inv.invoiceNumber || `STMT-${inv.id.slice(0, 8)}`,
      period: periodStr,
      issueDate: inv.generatedAt ? new Date(inv.generatedAt).toLocaleDateString('en-IN') : 'Cycle Close',
      dueDate: inv.dueDate || 'Upon Receipt',
      totalLitres: inv.totalQuantity || 0,
      totalAmount: inv.totalAmount || 0,
      paidAmount: inv.paidAmount || 0,
      status,
      pendingUtr: pendingPayment?.transactionRef,
      hashVerified: true,
    };
  });

  const totalVolumeYTD = invoices.reduce((acc, inv) => acc + (inv.totalQuantity || 0), 0);
  const totalPaidYTD = payments.reduce((acc, p) => (p.status === 'SUCCESS' ? acc + (p.amount || 0) : acc), 0);
  const currentOutstanding = invoices.reduce(
    (acc, inv) => acc + Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0)),
    0
  );

  return (
    <div className="space-y-6">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-6 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <CreditCard className="w-4 h-4 text-amber-600" />
            <span>Outstanding Balance</span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            ₹{currentOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {currentOutstanding > 0 ? 'Due across open billing cycles' : 'Account fully settled'}
          </div>
        </Card>

        <Card className="p-6 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>Total Settled YTD</span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            ₹{totalPaidYTD.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Automated UPI and bank receipts
          </div>
        </Card>

        <Card className="p-6 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Volume Delivered YTD</span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            {totalVolumeYTD.toFixed(1)} <span className="text-sm font-normal text-slate-400">L</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Single-estate cold-chain delivered
          </div>
        </Card>
      </div>

      {/* Statement Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Official Itemized Statements
            </h2>
            <p className="text-xs text-slate-500">
              Each statement contains cryptographic ledger proofs and itemized daily volume audit logs.
            </p>
          </div>
        </div>

        <StatementTable
          statements={statementItems}
          isLoading={isLoading}
          onViewInvoice={(item) => {
            const rawInv = invoices.find((i) => i.id === item.id);
            if (rawInv) onViewInvoice(rawInv);
          }}
          onPayStatement={(item) => {
            const rawInv = invoices.find((i) => i.id === item.id);
            if (rawInv) onPayInvoice(rawInv);
          }}
          onDownloadPdf={(item) => {
            const rawInv = invoices.find((i) => i.id === item.id);
            if (rawInv) onDownloadPdf(rawInv);
          }}
        />
      </div>
    </div>
  );
}

export default MemberStatements;
