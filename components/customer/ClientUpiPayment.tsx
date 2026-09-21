'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { CustomerProfile, Invoice, Payment } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Copy,
  Check,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Info,
  ChevronDown,
} from 'lucide-react';

interface ClientUpiPaymentProps {
  customer: CustomerProfile;
  invoices: Invoice[];
  payments: Payment[];
  onRefresh: () => void;
}

export function ClientUpiPayment({
  customer,
  invoices,
  payments,
  onRefresh,
}: ClientUpiPaymentProps) {
  const upiId = '9980592787@ybl';
  const payeeName = 'Green Valley Dairy';
  const adminName = 'Praveen';
  const registeredPhone = '+91 99805 92787';

  // Find due invoices
  const dueInvoices = invoices.filter(
    (inv) => inv.status !== 'PAID' && (inv.totalAmount - (inv.paidAmount || 0)) > 0
  );
  const totalOutstanding = dueInvoices.reduce(
    (acc, inv) => acc + Math.max(0, inv.totalAmount - (inv.paidAmount || 0)),
    0
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(() => {
    return dueInvoices[0]?.id || invoices[0]?.id || '';
  });

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId) || dueInvoices[0] || invoices[0];
  const invoiceBalance = selectedInvoice
    ? Math.max(0, selectedInvoice.totalAmount - (selectedInvoice.paidAmount || 0))
    : 1500;

  const [paymentAmount, setPaymentAmount] = useState<string>(() => {
    return invoiceBalance > 0 ? String(invoiceBalance) : '1500';
  });

  const [paymentMode, setPaymentMode] = useState<string>('UPI_PHONEPE');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [clientNotes, setClientNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [generatedQrUrl, setGeneratedQrUrl] = useState<string>('');

  // Keep selected invoice in sync when invoices are loaded or updated
  useEffect(() => {
    if (!selectedInvoiceId || !invoices.some((i) => i.id === selectedInvoiceId)) {
      const active = dueInvoices[0] || invoices[0];
      if (active) {
        setSelectedInvoiceId(active.id);
        const bal = Math.max(0, active.totalAmount - (active.paidAmount || 0));
        setPaymentAmount(String(bal > 0 ? bal : (active.totalAmount || 1500)));
      }
    }
  }, [invoices, dueInvoices, selectedInvoiceId]);

  // Generate dynamic QR code matching the amount
  useEffect(() => {
    const amt = parseFloat(paymentAmount) || invoiceBalance || 0;
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
      payeeName
    )}&am=${amt > 0 ? amt.toFixed(2) : '1500.00'}&cu=INR&tn=${encodeURIComponent(
      `MilkBill-${selectedInvoice?.invoiceNumber || customer.customerCode || 'MK-001'}`
    )}`;

    QRCode.toDataURL(upiUri, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setGeneratedQrUrl(url))
      .catch((err) => console.error('Failed to generate UPI QR', err));
  }, [paymentAmount, selectedInvoice, customer.customerCode, invoiceBalance]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanUtr = utrNumber.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      setFeedback({
        type: 'error',
        message: 'Please enter a valid 12-digit UPI reference number (UTR) from your PhonePe/UPI receipt.',
      });
      return;
    }

    const targetInvoice = selectedInvoice || invoices[0];
    const targetInvoiceId = targetInvoice?.id || (selectedInvoiceId !== 'CURRENT_CYCLE' ? selectedInvoiceId : '') || 'inv_ram_202609';

    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setFeedback({
        type: 'error',
        message: 'Please enter a valid payment amount.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: targetInvoiceId,
          customerId: customer.id,
          amount: amt,
          paymentMethod: paymentMode,
          transactionRef: cleanUtr,
          notes: clientNotes ? `Client Ref: ${cleanUtr} • ${clientNotes}` : `Client Ref: ${cleanUtr}`,
          status: 'PENDING',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: `Payment submitted successfully with UTR ${cleanUtr}! Admin ${adminName} will cross-check your bank/UPI statement. Once verified, your invoice will be marked Paid. If not verified, it remains Due.`,
        });
        setUtrNumber('');
        setClientNotes('');
        onRefresh();
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Failed to submit payment. Please try again.',
        });
      }
    } catch (err) {
      console.error('Submit payment error:', err);
      setFeedback({
        type: 'error',
        message: 'Network error submitting payment. Please check connection.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Client-relevant payments
  const clientPayments = payments.filter((p) => p.customerId === customer.id || !p.customerId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Direct Merchant UPI Settlement</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            UPI & QR Code Payment
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pay directly via PhonePe, Google Pay, or Paytm. Submit your 12-digit UTR number for manual admin confirmation.
          </p>
        </div>

        <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 text-right w-full sm:w-auto">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Total Outstanding Balance
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
            {dueInvoices.length} billing cycle{dueInvoices.length === 1 ? '' : 's'} due
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="font-medium leading-relaxed">{feedback.message}</div>
        </div>
      )}

      {/* Main Grid: Left = QR & UPI ID, Right = UTR Submission Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Scan & Pay via UPI */}
        <Card className="p-6 bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Scan & Pay via UPI
                </h2>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Official Merchant QR
              </span>
            </div>

            {/* Official QR Code Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <div className="inline-block p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
                {generatedQrUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={generatedQrUrl}
                    alt="Official Merchant UPI QR Code"
                    className="w-48 h-48 mx-auto rounded-xl"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src="/images/upi-qr.png"
                    alt="Official Merchant UPI QR Code"
                    className="w-48 h-48 mx-auto rounded-xl"
                  />
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-2">
                Scan with <strong className="text-slate-700">PhonePe</strong>, <strong className="text-slate-700">Google Pay</strong>, or <strong className="text-slate-700">Paytm</strong>
              </p>
            </div>

            {/* Account Metadata Details */}
            <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Payee Business:</span>
                <span className="font-bold text-slate-900">{payeeName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Admin Contact:</span>
                <span className="font-medium text-slate-700">{adminName} ({registeredPhone})</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Receiving UPI ID</div>
                  <div className="font-mono font-bold text-slate-900 text-sm select-all">{upiId}</div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedUpi ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Deep link button */}
          <div className="pt-4">
            <a
              href={`upi://pay?pa=${upiId}&pn=${encodeURIComponent(
                payeeName
              )}&am=${parseFloat(paymentAmount) || 1500}&cu=INR`}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <span>Open in PhonePe / UPI App</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </Card>

        {/* Step 2: Submit UTR for Admin Verification */}
        <Card className="p-6 bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <form onSubmit={handleSubmitUtr} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Enter UTR to Confirm
                </h2>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                Admin Verifies
              </span>
            </div>

            {/* Target Invoice Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Target Statement / Invoice</label>
              <div className="relative">
                <select
                  value={selectedInvoiceId || (invoices[0]?.id || 'CURRENT_CYCLE')}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    const inv = invoices.find((i) => i.id === e.target.value);
                    if (inv) {
                      const bal = Math.max(0, inv.totalAmount - (inv.paidAmount || 0));
                      setPaymentAmount(String(bal > 0 ? bal : inv.totalAmount || 1500));
                    }
                  }}
                  className="w-full pl-3.5 pr-9 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white hover:border-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition text-slate-900 appearance-none cursor-pointer shadow-xs"
                >
                  {invoices.length === 0 ? (
                    <option value="CURRENT_CYCLE">
                      Current Billing Statement (Sept 2026) • ₹1,500.00 (Due)
                    </option>
                  ) : (
                    <>
                      {invoices.map((inv) => {
                        const bal = Math.max(0, inv.totalAmount - (inv.paidAmount || 0));
                        return (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoiceNumber || `Statement #${inv.id.slice(0, 8)}`} • Balance: ₹{bal.toFixed(2)} ({inv.status})
                          </option>
                        );
                      })}
                      <option value="CURRENT_CYCLE">
                        Current Cycle Advance / Additional Settlement
                      </option>
                    </>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Amount Paid (₹)</label>
              <input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="1500"
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 text-slate-900"
                required
              />
            </div>

            {/* Payment Mode Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Payment Channel Used</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'UPI_PHONEPE', label: 'PhonePe' },
                  { id: 'UPI_GPAY', label: 'GPay' },
                  { id: 'UPI_PAYTM', label: 'Paytm' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPaymentMode(mode.id)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      paymentMode === mode.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 12-Digit UTR Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Bank / UPI Reference (UTR) *
                </label>
                <span className="text-[10px] font-mono text-slate-400">12 digits</span>
              </div>
              <input
                type="text"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="e.g. 426819283741"
                maxLength={32}
                className="w-full px-3 py-2 text-sm font-mono font-bold tracking-wider rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 text-slate-900"
                required
              />
              <p className="text-[11px] text-slate-500">
                Check your PhonePe payment receipt for &quot;UPI Ref No.&quot; or &quot;UTR&quot;.
              </p>
            </div>

            {/* Optional Note */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Client Note (Optional)</label>
              <input
                type="text"
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="e.g. Paid via PhonePe from Ram account"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 text-slate-900"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              leftIcon={<CreditCard className="w-4 h-4" />}
            >
              {isSubmitting ? 'Submitting UTR...' : 'Submit UTR for Admin Verification'}
            </Button>
          </form>

          <div className="mt-4 p-3 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Verification Policy:</strong> The admin cross-checks every submitted UTR against their PhonePe/bank statement. Once confirmed, your statement is marked as <strong>PAID</strong>. If invalid or unpaid, it remains <strong>DUE</strong>.
            </div>
          </div>
        </Card>
      </div>

      {/* Submitted Payments & Verification Audit Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Payment Submission & Verification Audit
            </h3>
            <p className="text-xs text-slate-500">
              Track whether your submitted payments have been verified and confirmed by the estate admin.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
          >
            Refresh Status
          </button>
        </div>

        {clientPayments.length === 0 ? (
          <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
            No payments submitted yet. Pay via UPI above and enter your UTR reference to record payment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Submitted UTR</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3 text-center">Admin Verification</th>
                  <th className="px-4 py-3">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientPayments.map((p) => {
                  const isPending = p.status === 'PENDING';
                  const isSuccess = p.status === 'SUCCESS';
                  const isFailed = p.status === 'FAILED';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 text-slate-500 font-medium">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : 'Recent'}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {p.transactionRef}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900 tabular-nums">
                        ₹{p.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {p.paymentMethod.replace('UPI_', '')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isPending && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 mr-1 animate-pulse text-amber-600" />
                            Awaiting Admin
                          </span>
                        )}
                        {isSuccess && (
                          <Badge variant="emerald" className="text-[10px] uppercase font-black">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Paid & Confirmed
                          </Badge>
                        )}
                        {isFailed && (
                          <Badge variant="danger" className="text-[10px] uppercase font-black">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Rejected (Due)
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {isPending && 'Admin has not verified yet. Invoice remains Due.'}
                        {isSuccess && `Receipt: ${p.receiptNumber} • Settled in client account.`}
                        {isFailed && 'Admin rejected reference. Please verify UTR or retry.'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientUpiPayment;
