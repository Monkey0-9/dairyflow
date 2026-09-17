'use client';

import React from 'react';
import { X, Printer, CheckCircle2, AlertCircle, Droplets, Download } from 'lucide-react';
import { Invoice } from '@/lib/types';

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onPayNow?: (invoice: Invoice) => void;
  isCustomerView?: boolean;
}

export default function InvoiceModal({
  invoice,
  onClose,
  onPayNow,
  isCustomerView = false,
}: InvoiceModalProps) {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tax / Dairy Invoice
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                invoice.status === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800'
                  : invoice.status === 'PARTIALLY_PAID'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {invoice.status.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div id="printable-document" className="p-8 text-slate-800">
          {/* Farm Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 leading-tight">
                    GreenValley Dairy Farm
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Pure & Fresh Subscription Milk • Anand, Gujarat
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                FSSAI Lic No: 10023021004812 • UPI: greenvalley@okaxis
              </p>
            </div>

            <div className="sm:text-right">
              <div className="text-xs font-bold text-slate-400 uppercase">Invoice Number</div>
              <div className="text-sm font-extrabold text-slate-900 font-mono">
                {invoice.invoiceNumber}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Date: {new Date(invoice.generatedAt).toLocaleDateString()}
              </div>
              <div className="text-xs text-slate-500">
                Period: <span className="font-semibold">{invoice.monthName}</span>
              </div>
            </div>
          </div>

          {/* Customer & Bill Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-xs">
            <div>
              <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                Billed To
              </div>
              <div className="font-bold text-slate-900 text-sm">{invoice.customerName}</div>
              <div className="text-slate-600 mt-0.5">{invoice.customerAddress}</div>
              <div className="text-slate-600 mt-0.5">Phone: {invoice.customerPhone}</div>
            </div>

            <div className="sm:text-right">
              <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                Payment Terms
              </div>
              <div className="text-slate-600">
                Due Date:{' '}
                <span className="font-bold text-slate-800">
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </span>
              </div>
              {invoice.lastPaymentAt && (
                <div className="text-slate-600 mt-0.5">
                  Last Payment: {new Date(invoice.lastPaymentAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="py-6 border-b border-slate-200">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3">Product Description</th>
                  <th className="pb-3 text-center">Delivered Litres</th>
                  <th className="pb-3 text-right">Rate / Litre</th>
                  <th className="pb-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((item) => (
                  <tr key={item.id} className="py-2.5">
                    <td className="py-3 font-semibold text-slate-900">{item.productName}</td>
                    <td className="py-3 text-center font-mono font-medium">
                      {item.totalQuantity} L
                    </td>
                    <td className="py-3 text-right font-mono">₹{item.pricePerUnit.toFixed(2)}</td>
                    <td className="py-3 text-right font-mono font-bold text-slate-900">
                      ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-6">
            <div className="text-xs text-slate-500 max-w-xs">
              <div className="font-semibold text-slate-700">Digital Ledger Verified</div>
              <p className="mt-1 leading-relaxed">
                Total litres calculated directly from daily recorded deliveries, skips, and partials.
                No paper register discrepancies.
              </p>
            </div>

            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">
                  ₹{invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {invoice.creditsOrAdjustments > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Adjustment / Discount:</span>
                  <span className="font-mono">
                    -₹{invoice.creditsOrAdjustments.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Bill:</span>
                <span className="font-mono">
                  ₹{invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Paid to Date:</span>
                <span className="font-mono font-semibold text-emerald-600">
                  ₹{invoice.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-rose-600 pt-1 border-t border-slate-100">
                <span>Balance Due:</span>
                <span className="font-mono">
                  ₹{invoice.outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer (No Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            Close
          </button>
          {invoice.outstandingAmount > 0 && onPayNow && (
            <button
              onClick={() => onPayNow(invoice)}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
            >
              <span>Pay Balance ₹{invoice.outstandingAmount.toLocaleString()}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
