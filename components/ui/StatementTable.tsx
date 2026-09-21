'use client';

import React from 'react';
import { Download, CreditCard, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';

export interface StatementItem {
  id: string;
  statementNumber: string;
  period: string;
  issueDate: string;
  dueDate: string;
  totalLitres: number;
  totalAmount: number;
  paidAmount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'PARTIAL' | 'VERIFYING';
  pendingUtr?: string;
  pdfUrl?: string;
  hashVerified?: boolean;
}

interface StatementTableProps {
  statements: StatementItem[];
  onViewInvoice?: (statement: StatementItem) => void;
  onDownloadPdf?: (statement: StatementItem) => void;
  onPayStatement?: (statement: StatementItem) => void;
  isLoading?: boolean;
}

export function StatementTable({
  statements,
  onViewInvoice,
  onDownloadPdf,
  onPayStatement,
  isLoading = false,
}: StatementTableProps) {
  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-18 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
          />
        ))}
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <div className="py-14 text-center rounded-3xl border border-dashed border-slate-200 bg-white/50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          No Statements Issued
        </p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Statements are compiled at the close of each billing cycle with cryptographic ledger verification.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: StatementItem['status']) => {
    switch (status) {
      case 'PAID':
        return (
          <Badge variant="emerald" className="text-[10px] tracking-wide uppercase font-black">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Settled
          </Badge>
        );
      case 'VERIFYING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            <Clock className="w-3 h-3 mr-1 animate-pulse text-blue-600" />
            Admin Verifying
          </span>
        );
      case 'OVERDUE':
        return (
          <Badge variant="danger" className="text-[10px] tracking-wide uppercase font-black">
            <AlertCircle className="w-3 h-3 mr-1" />
            Overdue
          </Badge>
        );
      case 'PARTIAL':
        return (
          <Badge variant="warning" className="text-[10px] tracking-wide uppercase font-black">
            <Clock className="w-3 h-3 mr-1" />
            Partial
          </Badge>
        );
      case 'PENDING':
      default:
        return (
          <Badge variant="warning" className="text-[10px] tracking-wide uppercase font-black">
            <Clock className="w-3 h-3 mr-1" />
            Due
          </Badge>
        );
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-5">Billing Period</th>
              <th className="py-3.5 px-4">Statement #</th>
              <th className="py-3.5 px-4 text-right">Volume</th>
              <th className="py-3.5 px-4 text-right">Total Payable</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {statements.map((st) => {
              const balanceDue = Math.max(0, st.totalAmount - st.paidAmount);
              return (
                <tr
                  key={st.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="py-4 px-5">
                    <div className="font-black text-slate-900">
                      {st.period}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Due: {st.dueDate}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-600 font-medium">
                    {st.statementNumber}
                    {st.hashVerified && (
                      <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" title="Cryptographically chained" />
                    )}
                  </td>
                  <td className="py-4 px-4 text-right tabular-nums font-semibold text-slate-700">
                    {st.totalLitres.toFixed(1)} L
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="tabular-nums font-black text-slate-900 text-sm">
                      ₹{st.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    {st.status !== 'PAID' && balanceDue > 0 && balanceDue !== st.totalAmount && (
                      <div className="text-[10px] text-amber-600 tabular-nums">
                        ₹{balanceDue.toFixed(2)} remaining
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {getStatusBadge(st.status)}
                    {st.pendingUtr && (
                      <div className="text-[10px] text-blue-600 font-mono mt-0.5">
                        UTR: {st.pendingUtr}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onDownloadPdf && (
                        <button
                          type="button"
                          onClick={() => onDownloadPdf(st)}
                          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          title="Download Signed PDF"
                          aria-label="Download Signed PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {st.status === 'VERIFYING' ? (
                        <span className="inline-flex items-center text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200">
                          Awaiting Admin
                        </span>
                      ) : st.status !== 'PAID' && onPayStatement ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onPayStatement(st)}
                          leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                        >
                          Pay
                        </Button>
                      ) : null}
                      {onViewInvoice && (
                        <button
                          type="button"
                          onClick={() => onViewInvoice(st)}
                          className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                          title="View Statement Details"
                          aria-label="View Statement Details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StatementTable;
