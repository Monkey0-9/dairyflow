'use client';

import React, { useState } from 'react';
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  Droplets,
  Scale,
  Calendar,
  X,
  ShieldCheck,
} from 'lucide-react';

interface EndOfDayClosingModalProps {
  selectedDate: string;
  totalDelivered: number;
  totalExpected: number;
  skippedCount: number;
  onClose: () => void;
  onConfirmCloseDay: (data: {
    cowMilkProduced: number;
    buffaloMilkProduced: number;
    a2MilkProduced: number;
    remainingStock: number;
    wasteOrSpillage: number;
    personalConsumption: number;
  }) => Promise<void>;
}

export default function EndOfDayClosingModal({
  selectedDate,
  totalDelivered,
  totalExpected,
  skippedCount,
  onClose,
  onConfirmCloseDay,
}: EndOfDayClosingModalProps) {
  const [cowProduced, setCowProduced] = useState('55.0');
  const [buffaloProduced, setBuffaloProduced] = useState('22.0');
  const [a2Produced, setA2Produced] = useState('8.0');
  const [remainingStock, setRemainingStock] = useState(
    Math.max(0, 85 - totalDelivered - 2.0).toFixed(1)
  );
  const [waste, setWaste] = useState('1.0');
  const [personal, setPersonal] = useState('1.0');
  const [isClosing, setIsClosing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const totalProduced =
    (parseFloat(cowProduced) || 0) +
    (parseFloat(buffaloProduced) || 0) +
    (parseFloat(a2Produced) || 0);

  const accounted =
    totalDelivered +
    (parseFloat(remainingStock) || 0) +
    (parseFloat(waste) || 0) +
    (parseFloat(personal) || 0);

  const discrepancy = parseFloat((totalProduced - accounted).toFixed(1));
  const isBalanced = Math.abs(discrepancy) < 0.1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsClosing(true);
    setErrorMsg('');
    try {
      await onConfirmCloseDay({
        cowMilkProduced: parseFloat(cowProduced),
        buffaloMilkProduced: parseFloat(buffaloProduced),
        a2MilkProduced: parseFloat(a2Produced),
        remainingStock: parseFloat(remainingStock),
        wasteOrSpillage: parseFloat(waste),
        personalConsumption: parseFloat(personal),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error closing day');
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">End-of-Day Ledger Closing</h3>
              <p className="text-[11px] text-slate-500">Date: {selectedDate} • Daily Milk Balance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Deliveries Summary Banner */}
          <div className="grid grid-cols-3 gap-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-center">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Delivered</div>
              <div className="text-base font-black text-emerald-700 font-mono mt-0.5">
                {totalDelivered} L
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Scheduled</div>
              <div className="text-base font-black text-slate-800 font-mono mt-0.5">
                {totalExpected} L
              </div>
            </div>
            <div>
              <div className="text-[10px] text-rose-500 uppercase font-bold">Exceptions</div>
              <div className="text-base font-black text-rose-600 font-mono mt-0.5">
                {skippedCount} Skips
              </div>
            </div>
          </div>

          {/* Morning Production Inputs */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Morning Milking Production (Litres):
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block">Cow Milk:</span>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={cowProduced}
                  onChange={(e) => setCowProduced(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Buffalo Milk:</span>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={buffaloProduced}
                  onChange={(e) => setBuffaloProduced(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">A2 Desi Cow:</span>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={a2Produced}
                  onChange={(e) => setA2Produced(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="text-right text-[11px] font-bold text-slate-600 mt-1 font-mono">
              Total Produced: {totalProduced} L
            </div>
          </div>

          {/* Inventory Breakdown Inputs */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Remaining Tank</label>
              <input
                type="number"
                step="0.5"
                required
                value={remainingStock}
                onChange={(e) => setRemainingStock(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Spillage / Waste</label>
              <input
                type="number"
                step="0.1"
                required
                value={waste}
                onChange={(e) => setWaste(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Personal / Home</label>
              <input
                type="number"
                step="0.5"
                required
                value={personal}
                onChange={(e) => setPersonal(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Dairy Reconciliation Equation Banner */}
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
              isBalanced
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4" />
              <div>
                <span className="font-bold">Reconciliation Balance: </span>
                <span className="font-mono">
                  {totalProduced} L Produced vs {accounted} L Accounted
                </span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full font-bold font-mono ${
                isBalanced ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
              }`}
            >
              Diff: {discrepancy > 0 ? `+${discrepancy}` : discrepancy} L
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Closing locks today's ledger. Future modifications will require explicit authorized
              audit adjustments and cannot silently overwrite records.
            </span>
          </div>

          {errorMsg && <p className="text-rose-600 font-bold">{errorMsg}</p>}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isClosing}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isClosing ? 'Finalizing & Locking...' : 'Lock Ledger & Close Day'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
