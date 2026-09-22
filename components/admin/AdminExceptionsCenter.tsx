'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import type { ExtraMilkRequest, AdminOperationalStats } from '@/lib/types';

interface AdminExceptionsCenterProps {
  stats: AdminOperationalStats;
  openDisputeCount: number;
  pendingCustomerCount: number;
  totalPendingRequests: number;
  pendingExtraCount: number;
  extraRequests: ExtraMilkRequest[];
  onNavigateTab: (tab: string) => void;
  onReviewExtra: (requestId: string, action: 'APPROVED' | 'REJECTED') => void;
}

/** Operational exceptions + quick-approval strip — extracted from AdminPage. */
export function AdminExceptionsCenter({
  stats,
  openDisputeCount,
  pendingCustomerCount,
  totalPendingRequests,
  pendingExtraCount,
  extraRequests,
  onNavigateTab,
  onReviewExtra,
}: AdminExceptionsCenterProps) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Operational Exceptions Center</h3>
        </div>
        <span className="text-[11px] text-slate-500">1-Click Actions Required</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
        <button
          onClick={() => onNavigateTab('disputes')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
            openDisputeCount > 0
              ? 'bg-rose-50/80 border-rose-300 text-rose-950 hover:bg-rose-100'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="font-extrabold text-lg font-mono">{openDisputeCount}</div>
          <div className="font-bold text-[11px]">Open Disputes</div>
          <span className="text-[10px] opacity-80">{openDisputeCount > 0 ? 'Resolve Now →' : 'Zero Disputes'}</span>
        </button>

        <button
          onClick={() => onNavigateTab('customers')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
            pendingCustomerCount > 0
              ? 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="font-extrabold text-lg font-mono">{pendingCustomerCount}</div>
          <div className="font-bold text-[11px]">Pending Signups</div>
          <span className="text-[10px] opacity-80">{pendingCustomerCount > 0 ? 'Review & Approve →' : 'All Approved'}</span>
        </button>

        <button
          onClick={() => onNavigateTab('daily')}
          className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 text-left transition cursor-pointer"
        >
          <div className="font-extrabold text-lg font-mono">{stats.exceptionCounts.skipped}</div>
          <div className="font-bold text-[11px]">Skipped Today</div>
          <span className="text-[10px] text-slate-500">0 L Billable</span>
        </button>

        <button
          onClick={() => onNavigateTab('daily')}
          className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 text-left transition cursor-pointer"
        >
          <div className="font-extrabold text-lg font-mono">{stats.exceptionCounts.partial}</div>
          <div className="font-bold text-[11px]">Partial Today</div>
          <span className="text-[10px] text-slate-500">Delivered &lt; Expected</span>
        </button>

        <button
          onClick={() => onNavigateTab('requests')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
            totalPendingRequests > 0
              ? 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="font-extrabold text-lg font-mono">{totalPendingRequests}</div>
          <div className="font-bold text-[11px]">Customer Requests</div>
          <span className="text-[10px] opacity-80">{totalPendingRequests > 0 ? 'Review & Approve →' : 'Zero Pending'}</span>
        </button>

        <button
          onClick={() => onNavigateTab('billing')}
          className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 text-left transition cursor-pointer"
        >
          <div className="font-extrabold text-lg font-mono">{stats.exceptionCounts.overdueInvoices}</div>
          <div className="font-bold text-[11px]">Payment Due</div>
          <span className="text-[10px] text-slate-500">Send WhatsApp Bill →</span>
        </button>
      </div>

      {pendingExtraCount > 0 && extraRequests[0] && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <strong>Extra Milk Request:</strong>{' '}
              <span>
                {extraRequests[0].customerName} requested {extraRequests[0].requestedQuantity} L for {extraRequests[0].date} (&ldquo;{extraRequests[0].reason}&rdquo;)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onReviewExtra(extraRequests[0].id, 'APPROVED')}
              className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve (+1.0 L)</span>
            </button>
            <button
              onClick={() => onReviewExtra(extraRequests[0].id, 'REJECTED')}
              className="px-3 py-1 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminExceptionsCenter;
