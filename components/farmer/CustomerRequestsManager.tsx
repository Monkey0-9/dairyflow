'use client';

import React, { useState } from 'react';
import {
  PauseRequest,
  ExtraMilkRequest,
  CustomerProfile,
} from '@/lib/types';
import {
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  Search,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react';

interface CustomerRequestsManagerProps {
  pauseRequests: PauseRequest[];
  milkRequests: ExtraMilkRequest[];
  customers: CustomerProfile[];
  onReviewPause: (requestId: string, action: 'APPROVED' | 'REJECTED', reason?: string) => Promise<void>;
  onReviewMilk: (requestId: string, action: 'APPROVED' | 'REJECTED', reason?: string) => Promise<void>;
  onRefresh: () => void;
}

export default function CustomerRequestsManager({
  pauseRequests,
  milkRequests,
  customers,
  onReviewPause,
  onReviewMilk,
  onRefresh,
}: CustomerRequestsManagerProps) {
  const [filterType, setFilterType] = useState<'ALL_PENDING' | 'PAUSES' | 'EXTRA_MILK' | 'HISTORY'>('ALL_PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<{ id: string; type: 'PAUSE' | 'MILK'; customerName: string } | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  // Failed reviews keep the request PENDING with the server message.
  const [reviewError, setReviewError] = useState<string | null>(null);

  const pendingPauses = pauseRequests.filter((p) => p.status === 'PENDING');
  const pendingMilk = milkRequests.filter((m) => m.status === 'PENDING');
  const totalPending = pendingPauses.length + pendingMilk.length;

  const handleApprove = async (id: string, type: 'PAUSE' | 'MILK') => {
    setActionLoadingId(id);
    setReviewError(null);
    try {
      if (type === 'PAUSE') {
        await onReviewPause(id, 'APPROVED');
      } else {
        await onReviewMilk(id, 'APPROVED');
      }
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Approval failed to save. Please retry.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalItem) return;
    setActionLoadingId(rejectModalItem.id);
    setReviewError(null);
    try {
      if (rejectModalItem.type === 'PAUSE') {
        await onReviewPause(rejectModalItem.id, 'REJECTED', rejectionNote);
      } else {
        await onReviewMilk(rejectModalItem.id, 'REJECTED', rejectionNote);
      }
      // Parents throw on failure — reaching here means the review saved.
      setRejectModalItem(null);
      setRejectionNote('');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Rejection failed to save. Please retry.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Combine and sort for unified feed
  type UnifiedItem =
    | { itemType: 'PAUSE'; data: PauseRequest }
    | { itemType: 'MILK'; data: ExtraMilkRequest };

  const allItems: UnifiedItem[] = [
    ...pauseRequests.map((p) => ({ itemType: 'PAUSE' as const, data: p })),
    ...milkRequests.map((m) => ({ itemType: 'MILK' as const, data: m })),
  ];

  // Filtering
  const filteredItems = allItems.filter((item) => {
    // Tab filter
    if (filterType === 'ALL_PENDING') {
      if (item.data.status !== 'PENDING') return false;
    } else if (filterType === 'PAUSES') {
      if (item.itemType !== 'PAUSE') return false;
    } else if (filterType === 'EXTRA_MILK') {
      if (item.itemType !== 'MILK') return false;
    } else if (filterType === 'HISTORY') {
      if (item.data.status === 'PENDING') return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.data.customerName.toLowerCase().includes(q);
      const matchCode = item.data.customerCode.toLowerCase().includes(q);
      const matchReason = (item.data.reason || '').toLowerCase().includes(q);
      return matchName || matchCode || matchReason;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {reviewError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800" role="alert">
          <span className="font-bold">Review not saved: </span>{reviewError}
        </div>
      )}
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Server-Authoritative Synchronization</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Customer Requests Center</h1>
            <p className="text-emerald-100/80 text-xs mt-1 max-w-xl">
              Customer scheduling actions create pending server requests. Deliveries, billing calculations, and route plans only update after explicit farmer approval.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh requests"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Quick Stat Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs">
            <div className="text-[11px] font-semibold text-emerald-200 uppercase">Pending Review</div>
            <div className="text-2xl font-black font-mono mt-0.5 text-amber-300">
              {totalPending}
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs">
            <div className="text-[11px] font-semibold text-emerald-200 uppercase">Pause Requests</div>
            <div className="text-2xl font-black font-mono mt-0.5 text-white">
              {pendingPauses.length}
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs">
            <div className="text-[11px] font-semibold text-emerald-200 uppercase">Extra Milk Requests</div>
            <div className="text-2xl font-black font-mono mt-0.5 text-white">
              {pendingMilk.length}
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs">
            <div className="text-[11px] font-semibold text-emerald-200 uppercase">Total Processed</div>
            <div className="text-2xl font-black font-mono mt-0.5 text-emerald-300">
              {allItems.filter((i) => i.data.status !== 'PENDING').length}
            </div>
          </div>
        </div>
      </div>

      {/* Controls & Filter Tabs */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterType('ALL_PENDING')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filterType === 'ALL_PENDING'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>All Pending</span>
            {totalPending > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white text-amber-600 rounded-full text-[10px] font-black">
                {totalPending}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilterType('PAUSES')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filterType === 'PAUSES'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Vacation Pauses ({pauseRequests.length})</span>
          </button>

          <button
            onClick={() => setFilterType('EXTRA_MILK')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filterType === 'EXTRA_MILK'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Extra Milk ({milkRequests.length})</span>
          </button>

          <button
            onClick={() => setFilterType('HISTORY')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filterType === 'HISTORY'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Resolved History</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No requests found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {filterType === 'ALL_PENDING'
                ? 'All customer requests have been reviewed and approved or declined. All systems synchronized.'
                : 'No requests match your selected filter.'}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isPause = item.itemType === 'PAUSE';
            const req = item.data;
            const isPending = req.status === 'PENDING';
            const isApproved = req.status === 'APPROVED';
            const isLoading = actionLoadingId === req.id;

            // Find customer details for phone/address if available
            const cust = customers.find((c) => c.id === req.customerId);

            return (
              <div
                key={req.id}
                className={`bg-white rounded-3xl border p-5 transition-all shadow-xs hover:shadow-md ${
                  isPending
                    ? 'border-amber-200 bg-amber-50/10'
                    : isApproved
                    ? 'border-emerald-200 bg-emerald-50/5'
                    : 'border-slate-200 bg-slate-50/40'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left info column */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isPause
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isPause ? <Calendar className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          {req.customerName}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                          {req.customerCode}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                            isPause
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isPause ? 'Vacation Pause' : 'Extra Milk'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPending
                              ? 'bg-amber-100 text-amber-900'
                              : isApproved
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-rose-100 text-rose-900'
                          }`}
                        >
                          {isPending ? '⏳ Awaiting Review' : isApproved ? '✓ Approved' : '✕ Declined'}
                        </span>
                      </div>

                      {/* Detail row */}
                      {isPause ? (
                        <div className="text-xs text-slate-700">
                          <span className="font-semibold text-slate-900">Dates: </span>
                          <span className="font-mono font-bold bg-amber-50 text-amber-950 px-2 py-0.5 rounded border border-amber-200">
                            {(req as PauseRequest).startDate} to {(req as PauseRequest).endDate}
                          </span>
                          <span className="ml-2 text-slate-500">
                            (Deliveries will be marked SKIPPED, ₹0 billable)
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-700 flex flex-wrap items-center gap-2">
                          <div>
                            <span className="font-semibold text-slate-900">Delivery Date: </span>
                            <span className="font-mono font-bold bg-emerald-50 text-emerald-950 px-2 py-0.5 rounded border border-emerald-200">
                              {(req as ExtraMilkRequest).date}
                            </span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Quantity: </span>
                            <strong className="text-emerald-700 font-bold">
                              {(req as ExtraMilkRequest).requestedQuantity} L
                            </strong>{' '}
                            <span className="text-slate-500 text-[11px]">
                              (Normal: {(req as ExtraMilkRequest).normalQuantity} L)
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 font-bold text-[11px] bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                            {((req as ExtraMilkRequest).milkType || 'Cow').toUpperCase() === 'BUFFALO'
                              ? '🐃 Buffalo Milk'
                              : '🐄 Cow Milk (A2)'}
                          </span>
                        </div>
                      )}

                      {/* Reason */}
                      <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-xl border border-slate-100 max-w-xl">
                        &ldquo;{req.reason}&rdquo;
                      </div>

                      {/* Rejection note if any */}
                      {req.rejectionReason && (
                        <div className="text-xs text-rose-700 font-medium">
                          Decline Reason: {req.rejectionReason}
                        </div>
                      )}

                      {/* Metadata timestamp */}
                      <div className="text-[10px] text-slate-400 flex items-center gap-3 pt-0.5">
                        <span>Submitted: {new Date(req.createdAt).toLocaleString()}</span>
                        {cust && <span>Phone: {cust.phone}</span>}
                        {req.reviewedBy && <span>Reviewed by: {req.reviewedBy}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right actions column */}
                  <div className="flex items-center gap-2 lg:self-center shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0">
                    {isPending ? (
                      <>
                        <button
                          disabled={isLoading}
                          onClick={() => handleApprove(req.id, item.itemType)}
                          className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>

                        <button
                          disabled={isLoading}
                          onClick={() =>
                            setRejectModalItem({
                              id: req.id,
                              type: item.itemType,
                              customerName: req.customerName,
                            })
                          }
                          className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 px-3 py-1 bg-slate-100 rounded-xl">
                        Processed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Decline Reason Modal */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 font-extrabold text-sm">
                <AlertCircle className="w-5 h-5" />
                <span>Decline Customer Request</span>
              </div>
              <button
                onClick={() => {
                  setRejectModalItem(null);
                  setRejectionNote('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You are declining {rejectModalItem.customerName}&apos;s{' '}
              {rejectModalItem.type === 'PAUSE' ? 'vacation pause' : 'extra milk'} request. The customer will be notified with your explanation.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reason / Note for Customer
              </label>
              <textarea
                rows={3}
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="e.g. Daily quota already allocated, please call farm directly."
                className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setRejectModalItem(null);
                  setRejectionNote('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
