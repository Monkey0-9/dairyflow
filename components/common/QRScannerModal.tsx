'use client';

import React, { useState } from 'react';
import { X, QrCode, Search, Check, Zap, User } from 'lucide-react';
import { CustomerProfile } from '@/lib/types';

interface QRScannerModalProps {
  customers: CustomerProfile[];
  onScanSuccess: (customer: CustomerProfile) => void;
  onClose: () => void;
}

export default function QRScannerModal({
  customers,
  onScanSuccess,
  onClose,
}: QRScannerModalProps) {
  const [manualCode, setManualCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim().toUpperCase();
    const found = customers.find(
      (c) => c.customerCode.toUpperCase() === clean || c.name.toLowerCase().includes(clean.toLowerCase())
    );

    if (found) {
      onScanSuccess(found);
    } else {
      setErrorMsg(`No customer found with code "${manualCode}". Try MK-1024`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">QR Delivery Scanner</h3>
              <p className="text-[11px] text-slate-500">Instant Customer Identification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Simulated QR Viewfinder */}
          <div className="relative w-full aspect-square max-w-[240px] mx-auto bg-slate-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center text-white border-2 border-dashed border-emerald-500/80 shadow-inner">
            {/* Animated Laser Scan Line */}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce opacity-80" />

            <div className="w-40 h-40 border-2 border-emerald-400/60 rounded-xl relative flex items-center justify-center">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />
              <QrCode className="w-16 h-16 text-emerald-400/40 animate-pulse" />
            </div>

            <p className="text-[11px] text-slate-400 mt-3 font-medium">
              Point camera at door QR code
            </p>
          </div>

          {/* Quick Simulated Scan Pills */}
          <div className="mt-5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Tap Sample Customer QR to Test:
            </div>
            <div className="grid grid-cols-2 gap-2">
              {customers.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  onClick={() => onScanSuccess(c)}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition flex items-center justify-between group"
                >
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{c.customerCode}</div>
                  </div>
                  <Zap className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>

          {/* Manual Code Form */}
          <form onSubmit={handleManualSubmit} className="mt-5 pt-4 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Or Enter Customer Code Manually:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="e.g. MK-1024 or Ravi"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 uppercase font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Scan
              </button>
            </div>
            {errorMsg && <p className="text-[11px] text-rose-500 mt-1.5 font-medium">{errorMsg}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
