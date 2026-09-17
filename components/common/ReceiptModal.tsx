'use client';

import React from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Droplets } from 'lucide-react';
import { Payment } from '@/lib/types';

interface ReceiptModalProps {
  payment: Payment | null;
  onClose: () => void;
}

export default function ReceiptModal({ payment, onClose }: ReceiptModalProps) {
  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Payment Receipt
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
              SUCCESS
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Body */}
        <div id="printable-document" className="p-6 text-slate-800">
          <div className="text-center pb-6 border-b border-slate-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900">GreenValley Dairy Farm</h3>
            <p className="text-xs text-slate-500">Official Milk Payment Receipt</p>
            <div className="text-2xl font-black text-emerald-600 mt-3 font-mono">
              ₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="py-5 space-y-3 text-xs border-b border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">Receipt Number:</span>
              <span className="font-mono font-bold text-slate-900">{payment.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Customer Name:</span>
              <span className="font-semibold text-slate-900">{payment.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Date:</span>
              <span className="text-slate-800">{new Date(payment.paidAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Mode:</span>
              <span className="font-bold text-slate-800 uppercase">{payment.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction Ref:</span>
              <span className="font-mono text-slate-700">{payment.transactionRef}</span>
            </div>
            {payment.note && (
              <div className="flex justify-between">
                <span className="text-slate-500">Notes:</span>
                <span className="text-slate-700 italic">{payment.note}</span>
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center gap-2 text-[11px] text-slate-500 justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verified MilkFlow Digital Ledger Transaction</span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end no-print">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
