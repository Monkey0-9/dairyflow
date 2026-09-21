'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  X,
  AlertCircle,
  Building2,
  Banknote,
  Smartphone,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerPhone?: string;
  customerCode?: string;
  invoiceId: string;
  invoiceNumber: string;
  outstandingAmount: number;
  onPaymentSuccess: () => void;
}

interface PendingPayment {
  id: string;
  amount: number;
  transactionRef: string;
  paymentMethod: string;
  createdAt?: string;
  status: string;
}

export default function ManualPaymentModal({
  isOpen,
  onClose,
  customerName,
  customerPhone,
  customerCode,
  invoiceId,
  invoiceNumber,
  outstandingAmount,
  onPaymentSuccess,
}: ManualPaymentModalProps) {
  const [amount, setAmount] = useState(outstandingAmount.toString());
  const [method, setMethod] = useState<'CASH' | 'UPI' | 'NETBANKING'>('CASH');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [isConfirmingPending, setIsConfirmingPending] = useState(false);

  // Check if client already submitted a UTR for this invoice
  useEffect(() => {
    if (!isOpen || !invoiceId) return;
    let cancelled = false;

    const checkPending = async () => {
      try {
        const res = await fetch(`/api/payments?invoiceId=${encodeURIComponent(invoiceId)}&status=PENDING`);
        const data = await res.json();
        if (!cancelled && data.success && Array.isArray(data.payments) && data.payments.length > 0) {
          setPendingPayment(data.payments[0]);
        } else if (!cancelled) {
          setPendingPayment(null);
        }
      } catch (err) {
        console.error('[ManualPaymentModal] Failed to check pending payment:', err);
      }
    };

    checkPending();
    return () => {
      cancelled = true;
    };
  }, [isOpen, invoiceId]);

  if (!isOpen) return null;

  // Confirm client's submitted UTR
  const handleConfirmClientUtr = async () => {
    if (!pendingPayment) return;
    setIsConfirmingPending(true);
    setError(null);

    try {
      const res = await fetch('/api/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: pendingPayment.id,
          action: 'CONFIRM',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to confirm client payment.');
      }

      onPaymentSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error confirming payment.');
    } finally {
      setIsConfirmingPending(false);
    }
  };

  // Reject client's submitted UTR
  const handleRejectClientUtr = async () => {
    if (!pendingPayment) return;
    setIsConfirmingPending(true);
    setError(null);

    try {
      const res = await fetch('/api/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: pendingPayment.id,
          action: 'REJECT',
          rejectionReason: 'UTR not found on PhonePe statement',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject payment.');
      }

      setPendingPayment(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error rejecting payment.');
    } finally {
      setIsConfirmingPending(false);
    }
  };

  // Direct Admin manual settlement (Cash / Bank)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payAmt = parseFloat(amount);
    if (!Number.isFinite(payAmt) || payAmt <= 0) {
      setError('Please enter a valid positive payment amount.');
      return;
    }
    if (payAmt > outstandingAmount + 0.05) {
      setError(`Payment amount cannot exceed the outstanding balance of ₹${outstandingAmount.toFixed(2)}.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const refNo = `ADMIN_${method}_${Date.now()}`;
    const formattedNote = notes.trim()
      ? notes.trim()
      : `Manual settlement via ${method} by Admin`;

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          amount: payAmt,
          paymentMethod: method,
          transactionRef: refNo,
          notes: formattedNote,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record manual payment.');
      }

      onPaymentSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error recording payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 text-slate-900 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span>Manual Payment Update</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Admin Settle
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Immediately credits client account and settles authoritative invoice
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Client & Invoice Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Client Account:</span>
            <span className="font-bold text-slate-900">
              {customerName} {customerCode && <span className="font-mono text-slate-500">({customerCode})</span>}
            </span>
          </div>
          {customerPhone && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Registered Phone:</span>
              <span className="font-mono text-slate-700">{customerPhone}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Target Invoice:</span>
            <span className="font-mono font-bold text-amber-700">#{invoiceNumber}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <span className="font-bold text-slate-700">Outstanding Balance:</span>
            <span className="font-mono text-base font-black text-rose-600">
              ₹{outstandingAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* 1. Client-Submitted UTR Verification Section (If Client Submitted UTR) */}
        {pendingPayment && (
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-black text-xs text-amber-900">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Client Submitted UPI Payment Verification</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                Action Required
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Client Submitted UTR:</span>
                <strong className="text-slate-900 font-bold">{pendingPayment.transactionRef}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Claimed Amount:</span>
                <strong className="text-emerald-700 font-bold">₹{pendingPayment.amount.toFixed(2)}</strong>
              </div>
            </div>

            <p className="text-[11px] text-amber-800">
              Check your PhonePe app for UTR <strong>{pendingPayment.transactionRef}</strong>. Did the money arrive?
            </p>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="primary"
                isLoading={isConfirmingPending}
                onClick={handleConfirmClientUtr}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-xs text-xs py-2"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                ✓ Confirm Client Paid
              </Button>
              <button
                type="button"
                disabled={isConfirmingPending}
                onClick={handleRejectClientUtr}
                className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs transition cursor-pointer"
              >
                ✕ Reject UTR
              </button>
            </div>
          </div>
        )}

        {/* 2. Direct Admin Manual Settlement Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
            <span>Or Record Direct Offline Settlement</span>
            <span className="text-[10px] text-slate-400 font-normal">Farmer/Admin Settle</span>
          </div>

          {/* Amount Field */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Payment Amount Received (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
              <input
                type="number"
                step="0.01"
                min="1"
                max={outstandingAmount}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Enter cash or bank transfer amount received
            </span>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Payment Channel / Mode *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMethod('CASH')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  method === 'CASH'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Doorstep Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('UPI')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  method === 'UPI'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Direct UPI</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('NETBANKING')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  method === 'NETBANKING'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Bank / NEFT</span>
              </button>
            </div>
          </div>

          {/* Internal Memo */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Administrative Receipt Note (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received cash at doorstep from Ram"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-xs"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirm &amp; Settle in Client Account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
