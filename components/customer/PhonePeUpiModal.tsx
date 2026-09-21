'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Copy,
  Check,
  Smartphone,
  CheckCircle2,
  X,
  AlertCircle,
  ShieldCheck,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import confetti from 'canvas-confetti';

interface PhonePeUpiModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  customerName: string;
  onPaymentRecorded: () => void;
}

export default function PhonePeUpiModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  amount,
  customerName,
  onPaymentRecorded,
}: PhonePeUpiModalProps) {
  const upiId = '9980592787@ybl';
  const [copied, setCopied] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [selectedApp, setSelectedApp] = useState<'PhonePe' | 'Google Pay' | 'Paytm' | 'BHIM'>('PhonePe');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!isOpen) return null;

  const upiDeepLink = `upi://pay?pa=${upiId}&pn=Green%20Valley%20Dairy&am=${amount.toFixed(2)}&cu=INR&tn=Invoice%20${encodeURIComponent(invoiceNumber)}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClientSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUtr = utrNumber.trim();
    if (!cleanUtr) {
      setError('Please enter your 12-digit UPI Reference / UTR Number from your payment app receipt.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          amount,
          paymentMethod: 'UPI',
          transactionRef: cleanUtr,
          status: 'PENDING',
          notes: `Client confirmed payment via ${selectedApp} to ${upiId}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit payment verification.');
      }

      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } catch (confettiErr) {
        console.debug('[PhonePeUpiModal] Confetti animation failed:', confettiErr);
      }

      setSubmittedSuccess(true);
      onPaymentRecorded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection error while saving payment reference.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl border border-slate-200 p-5 sm:p-7 max-w-md w-full shadow-2xl space-y-5 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-700 shadow-xs">
              <span className="font-bold text-sm">पे</span>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                <span>PhonePe Direct UPI Settlement</span>
              </h3>
              <p className="text-[11px] text-slate-500">Green Valley Dairy Estate Official Reserve</p>
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

        {submittedSuccess ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                Pending Admin Confirmation
              </span>
              <h4 className="text-base font-black text-slate-900 pt-1">Payment Reference Submitted!</h4>
              <p className="text-xs text-slate-600">
                Your settlement of <strong className="text-emerald-700 font-mono">₹{amount.toFixed(2)}</strong> with UTR <span className="font-mono font-bold text-slate-900">#{utrNumber}</span> has been sent to the Estate Admin.
              </p>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Admin Verification Process:</span>
                </div>
                <p>The farm admin will cross-verify this UTR against their PhonePe/Bank statement and mark the invoice as paid.</p>
              </div>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={onClose}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Done &amp; Return to Dashboard
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Payable Summary Banner */}
            <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">Payable Balance</span>
                <div className="text-xs text-slate-700">
                  Invoice #{invoiceNumber} • <span className="font-semibold text-slate-900">{customerName}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black font-mono text-emerald-700 tabular-nums">
                  ₹{amount.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400">Zero Convenience Fee</div>
              </div>
            </div>

            {/* PhonePe QR Visual Container */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center space-y-3 shadow-xs">
              <div className="relative w-52 h-52 rounded-2xl overflow-hidden bg-white p-2 flex items-center justify-center shadow-md border border-slate-200">
                {/* QR Code Image */}
                <Image
                  src="/images/upi-qr.png"
                  alt="PhonePe UPI QR Code"
                  width={200}
                  height={200}
                  className="rounded-xl object-contain"
                  priority
                />
                {/* Center PhonePe Icon */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-9 h-9 rounded-full bg-purple-700 border-2 border-white flex items-center justify-center text-white font-black text-xs shadow-md">
                    पे
                  </div>
                </div>
              </div>

              {/* UPI ID Pill with Copy Action */}
              <div className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-[11px] font-mono text-slate-600 font-bold">
                    UPI ID: <span className="text-slate-900">{upiId}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* 1-Tap App Deep Link Button */}
              <a
                href={upiDeepLink}
                className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-purple-900/10 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in PhonePe / GPay App</span>
              </a>
            </div>

            {/* Client UTR Confirmation Section */}
            <form onSubmit={handleClientSubmitUtr} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Step 2: Enter UTR from Payment Receipt</span>
                </span>
                <span className="text-[10px] text-emerald-700 font-bold font-mono">Required</span>
              </div>

              {/* App selector */}
              <div className="grid grid-cols-4 gap-1.5">
                {(['PhonePe', 'Google Pay', 'Paytm', 'BHIM'] as const).map((app) => (
                  <button
                    key={app}
                    type="button"
                    onClick={() => setSelectedApp(app)}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition truncate cursor-pointer ${
                      selectedApp === app
                        ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {app}
                  </button>
                ))}
              </div>

              {/* UTR Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  12-digit UTR / UPI Reference Number *
                </label>
                <input
                  type="text"
                  required
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="e.g. 426819283741"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Found on your {selectedApp} confirmation screen under &#39;UPI Ref No&#39; or &#39;UTR&#39;
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-xs"
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Submit Payment UTR for Admin Confirmation
              </Button>
            </form>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Direct Bank Settlement • Verified via Cryptographic Audit Ledger</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
