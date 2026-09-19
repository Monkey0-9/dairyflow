'use client';

import React, { useState } from 'react';
import {
  FileText,
  DollarSign,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Send,
  Printer,
  CreditCard,
  Plus,
} from 'lucide-react';
import { Invoice, PaymentMethod } from '@/lib/types';
import InvoiceModal from '../common/InvoiceModal';
import { buildReminderMessage, buildWhatsAppLink } from '@/lib/reminders';
import { useT } from '@/lib/i18n';

interface BillingManagerProps {
  invoices: Invoice[];
  onRefresh: () => void;
  onRecalculateAll: () => Promise<void>;
  onRecordPayment: (
    invoiceId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    note?: string
  ) => Promise<void>;
}

export default function BillingManager({
  invoices,
  onRefresh,
  onRecalculateAll,
  onRecordPayment,
}: BillingManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeInvoiceForView, setActiveInvoiceForView] = useState<Invoice | null>(null);
  const [activeInvoiceForPay, setActiveInvoiceForPay] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('UPI');
  const [payNote, setPayNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  // Failed payment saves keep the modal open with the server message.
  const [payError, setPayError] = useState<string | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);
  const { t } = useT();

  // Financial KPI totals
  let totalBilled = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalLitres = 0;

  invoices.forEach((inv) => {
    totalBilled += inv.totalAmount;
    totalCollected += inv.paidAmount;
    totalOutstanding += inv.outstandingAmount;
    totalLitres += inv.totalQuantity;
  });

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    return statusFilter === inv.status;
  });

  const handleOpenRecordPayment = (inv: Invoice) => {
    setActiveInvoiceForPay(inv);
    setPayAmount(inv.outstandingAmount.toString());
    setPayMethod('CASH');
    setPayNote('');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoiceForPay || !payAmount) return;
    const amt = parseFloat(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPayError('Enter a valid payment amount greater than ₹0.');
      return;
    }
    if (amt > activeInvoiceForPay.outstandingAmount + 0.01) {
      setPayError(
        `Amount cannot exceed the outstanding balance of ₹${activeInvoiceForPay.outstandingAmount.toFixed(2)}.`
      );
      return;
    }
    setIsProcessing(true);
    setPayError(null);
    try {
      await onRecordPayment(
        activeInvoiceForPay.id,
        parseFloat(payAmount),
        payMethod,
        payNote || `Offline payment received via ${payMethod}`
      );
      // Parent throws on failure — reaching here means the payment saved.
      setActiveInvoiceForPay(null);
      onRefresh();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed to save. Please retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setRecalcError(null);
    try {
      await onRecalculateAll();
    } catch (err) {
      setRecalcError(err instanceof Error ? err.message : 'Recalculation failed. Please retry.');
    } finally {
      setIsRecalculating(false);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => {
    const headers = ['Invoice No', 'Customer', 'Phone', 'Month', 'Total Litres', 'Total Amount', 'Paid Amount', 'Outstanding', 'Status'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      `"${inv.customerName}"`,
      inv.customerPhone,
      inv.monthName,
      inv.totalQuantity,
      inv.totalAmount,
      inv.paidAmount,
      inv.outstandingAmount,
      inv.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MilkFlow_Billing_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Bill Reminder (multilingual via shared reminder templates)
  const [reminderLang, setReminderLang] = useState<'en' | 'hi' | 'mr'>('en');
  const handleSendWhatsAppReminder = (inv: Invoice) => {
    const message = buildReminderMessage({
      customerName: inv.customerName,
      dairyName: 'GreenValley Dairy Farm',
      amount: inv.outstandingAmount,
      lang: reminderLang,
      payLink: 'greenvalley@okaxis',
    });
    window.open(buildWhatsAppLink(inv.customerPhone, message), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <span>{t('billing.title')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            September 2026 • Ledger-calculated dynamically with instant offline/online payment tracking
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
            <span>{t('billing.reminder')}:</span>
            {(['en', 'hi', 'mr'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setReminderLang(l)}
                className={`px-2 py-1 rounded-lg border ${reminderLang === l ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600'}`}
              >
                {l === 'en' ? 'EN' : l === 'hi' ? 'हिं' : 'मर'}
              </button>
            ))}
          </div>
          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRecalculating ? 'Recalculating…' : 'Recalculate All From Ledger'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {recalcError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800" role="alert">
          <span className="font-bold">Recalculation failed: </span>{recalcError}
        </div>
      )}

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Milk Billed
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {totalLitres.toFixed(1)} <span className="text-sm font-bold text-slate-400">L</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">September Volume</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Billed Revenue
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            ₹{totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Subtotal Sum</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
            Collected Revenue
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            {Math.round((totalCollected / (totalBilled || 1)) * 100)}% Paid
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
            Outstanding Receivables
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1 font-mono">
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-rose-600 font-semibold mt-0.5">Pending Collection</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice by customer or invoice number..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {['ALL', 'PAID', 'PARTIALLY_PAID', 'UNPAID'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Invoice #</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5 text-center">Milk Qty</th>
                <th className="px-5 py-3.5 text-right">Total Bill</th>
                <th className="px-5 py-3.5 text-right">Paid</th>
                <th className="px-5 py-3.5 text-right">Outstanding</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const isPaid = inv.status === 'PAID';
                const isPartial = inv.status === 'PARTIALLY_PAID';

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-800">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">{inv.customerName}</div>
                      <div className="text-[11px] text-slate-400">{inv.customerPhone}</div>
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono font-semibold text-slate-700">
                      {inv.totalQuantity} L
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                      ₹{inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-emerald-600 font-semibold">
                      ₹{inv.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-extrabold text-rose-600">
                      ₹{inv.outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPartial
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {inv.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveInvoiceForView(inv)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition"
                          title="View Printable Invoice"
                        >
                          <Printer className="w-3 h-3" />
                          <span>View Bill</span>
                        </button>

                        {inv.outstandingAmount > 0 && (
                          <>
                            <button
                              onClick={() => handleOpenRecordPayment(inv)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Record Pay</span>
                            </button>

                            <button
                              onClick={() => handleSendWhatsAppReminder(inv)}
                              className="p-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                              title="Send WhatsApp Bill Reminder"
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          </>
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

      {/* Printable Invoice Modal */}
      {activeInvoiceForView && (
        <InvoiceModal
          invoice={activeInvoiceForView}
          onClose={() => setActiveInvoiceForView(null)}
          onPayNow={(inv) => {
            setActiveInvoiceForView(null);
            handleOpenRecordPayment(inv);
          }}
        />
      )}

      {/* Record Offline Payment Modal */}
      {activeInvoiceForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Record Offline Payment</h3>
                <p className="text-xs text-slate-500">
                  {activeInvoiceForPay.customerName} • {activeInvoiceForPay.invoiceNumber}
                </p>
              </div>
              <button
                onClick={() => setActiveInvoiceForPay(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-6 space-y-4 text-xs">
              {payError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                  <span className="font-bold">Payment not recorded: </span>{payError}
                </div>
              )}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500">Total Outstanding Due:</span>
                <span className="font-mono font-black text-rose-600 text-base">
                  ₹{activeInvoiceForPay.outstandingAmount.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="1"
                  required
                  max={activeInvoiceForPay.outstandingAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Method *</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-emerald-500"
                >
                  <option value="CASH">💵 Cash (Collected by Farmer)</option>
                  <option value="UPI">📱 Direct UPI (GPay / PhonePe / Paytm)</option>
                  <option value="NETBANKING">🏦 Bank Transfer (NEFT / IMPS)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Receipt Note / Memo</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Received cash at doorstep, Month final settlement"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveInvoiceForPay(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition"
                >
                  {isProcessing ? 'Recording...' : 'Record Payment & Issue Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
