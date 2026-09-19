'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Phone,
  MessageCircle,
  Clock,
  User,
  Droplets,
  Calendar,
  Check,
} from 'lucide-react';
import { Dispute } from '@/lib/types';

interface DisputeResolverProps {
  disputes: Dispute[];
  onResolveDispute: (
    disputeId: string,
    action: 'ACCEPT' | 'REJECT' | 'CUSTOM',
    customQty?: number,
    note?: string
  ) => Promise<void>;
  onRefresh: () => void;
}

export default function DisputeResolver({
  disputes,
  onResolveDispute,
  onRefresh,
}: DisputeResolverProps) {
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [customQty, setCustomQty] = useState('0');
  const [farmerNote, setFarmerNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // Failed resolutions keep the claim open with the server message.
  const [resolveError, setResolveError] = useState<string | null>(null);

  const openDisputes = disputes.filter((d) => d.status === 'OPEN');
  const resolvedDisputes = disputes.filter((d) => d.status !== 'OPEN');

  const handleQuickAccept = async (d: Dispute) => {
    setIsProcessing(true);
    setResolveError(null);
    try {
      await onResolveDispute(d.id, 'ACCEPT', d.claimedQuantity, 'Claim accepted by farmer');
      onRefresh();
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to resolve dispute. Please retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickReject = async (d: Dispute) => {
    setIsProcessing(true);
    setResolveError(null);
    try {
      await onResolveDispute(d.id, 'REJECT', d.recordedQuantity, 'Delivery re-verified at customer doorstep');
      onRefresh();
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to resolve dispute. Please retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispute) return;
    setIsProcessing(true);
    setResolveError(null);
    try {
      await onResolveDispute(
        selectedDispute.id,
        'CUSTOM',
        parseFloat(customQty),
        farmerNote || 'Custom settlement agreed with customer'
      );
      // Parent throws on failure — reaching here means the settlement saved.
      setSelectedDispute(null);
      onRefresh();
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to settle dispute. Please retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {resolveError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800" role="alert">
          <span className="font-bold">Dispute not resolved: </span>{resolveError}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Delivery Dispute Resolution Hub</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Resolve delivery exception claims raised by customers with automatic ledger & bill reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200">
            {openDisputes.length} Open Claims
          </span>
        </div>
      </div>

      {/* Open Disputes Queue */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Pending Customer Claims
        </h3>

        {openDisputes.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <div className="font-bold text-slate-800">All customer disputes are resolved!</div>
            <p className="mt-0.5 text-slate-400">
              No pending milk delivery disagreements at this moment.
            </p>
          </div>
        ) : (
          openDisputes.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-3xl p-6 border-2 border-rose-300 shadow-md relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-xs font-mono font-bold">
                      {d.customerCode}
                    </span>
                    <h4 className="text-base font-black text-slate-900">{d.customerName}</h4>
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                      <Calendar className="w-3 h-3" />
                      <span>{d.date}</span>
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-4 max-w-sm bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        Recorded on Ledger
                      </div>
                      <div className="text-sm font-black text-slate-800 font-mono mt-0.5">
                        {d.recordedQuantity} Litres
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-rose-600 font-bold uppercase">
                        Customer Claim
                      </div>
                      <div className="text-sm font-black text-rose-600 font-mono mt-0.5">
                        {d.claimedQuantity} Litres ({d.reason ? d.reason.replace(/_/g, ' ') : 'General Claim'})
                      </div>
                    </div>
                  </div>

                  {/* Customer Note */}
                  <div className="mt-3 p-3 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs text-amber-900">
                    <span className="font-bold">Customer Comment: </span>
                    <span className="italic">&ldquo;{d.customerNote || 'No description provided'}&rdquo;</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-56 shrink-0">
                  <button
                    onClick={() => handleQuickAccept(d)}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Accept & Settle at {d.claimedQuantity} L</span>
                  </button>

                  <button
                    onClick={() => handleQuickReject(d)}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Keep {d.recordedQuantity} L (Reject)</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedDispute(d);
                      setCustomQty(d.claimedQuantity.toString());
                    }}
                    className="w-full py-2 px-4 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition"
                  >
                    Custom Settlement...
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resolved Disputes Archive */}
      {resolvedDisputes.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-slate-200">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Resolved Disputes History
          </h3>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {resolvedDisputes.map((d) => (
              <div key={d.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{d.customerName}</span>
                    <span className="text-slate-400 font-mono">{d.date}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-1 italic">"{d.customerNote}"</p>
                  {d.farmerNote && (
                    <p className="text-emerald-700 text-[11px] mt-0.5 font-semibold">
                      Resolution: {d.farmerNote}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-slate-700">
                    Settled: {d.claimedQuantity} L
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {d.resolvedAt ? new Date(d.resolvedAt).toLocaleDateString() : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Settlement Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <h3 className="text-base font-extrabold text-slate-900">Custom Dispute Settlement</h3>
              <button
                onClick={() => setSelectedDispute(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCustomSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">{selectedDispute.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-semibold">{selectedDispute.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Originally Recorded:</span>
                  <span className="font-mono font-bold">{selectedDispute.recordedQuantity} L</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Agreed Final Delivery Quantity (Litres) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="10"
                  required
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Settlement Reason / Note
                </label>
                <input
                  type="text"
                  value={farmerNote}
                  onChange={(e) => setFarmerNote(e.target.value)}
                  placeholder="e.g. Partial spill during transit, compensated with 0.5L"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispute(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition"
                >
                  Confirm Settlement & Reconcile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
