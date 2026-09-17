'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Scale,
  Droplets,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { InventoryReconciliation } from '@/lib/types';
import EndOfDayClosingModal from './EndOfDayClosingModal';

interface InventoryManagerProps {
  selectedDate: string;
  totalDelivered: number;
  totalExpected: number;
  skippedCount: number;
  onRefresh: () => void;
}

export default function InventoryManager({
  selectedDate,
  totalDelivered,
  totalExpected,
  skippedCount,
  onRefresh,
}: InventoryManagerProps) {
  const [reconciliation, setReconciliation] = useState<InventoryReconciliation | null>(null);
  const [dayLockStatus, setDayLockStatus] = useState<string>('OPEN');
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory?date=${selectedDate}`);
      const data = await res.json();
      if (data.success) {
        setReconciliation(data.reconciliation);
        setDayLockStatus(data.dayLockStatus);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedDate]);

  const handleConfirmCloseDay = async (formData: any) => {
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        ...formData,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setReconciliation(data.reconciliation);
      setDayLockStatus('FINALIZED');
      onRefresh();
    }
  };

  if (loading || !reconciliation) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">
        <Droplets className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
        <div>Calculating dairy production & tank inventory balances...</div>
      </div>
    );
  }

  const isFinalized = dayLockStatus === 'FINALIZED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isFinalized ? 'bg-slate-500' : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Dairy Inventory & Daily Production Balance</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Date: {selectedDate} • Reconcile milking output vs route delivery volume vs tank reserves
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full uppercase border ${
              isFinalized
                ? 'bg-slate-100 text-slate-700 border-slate-300'
                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}
          >
            Ledger Status: {dayLockStatus}
          </span>

          <button
            onClick={() => setShowClosingModal(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition ${
              isFinalized
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isFinalized ? 'Review Closing Balance' : 'End of Day Closing'}</span>
          </button>
        </div>
      </div>

      {/* Main KPI Inventory Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Morning Milking Output
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            {reconciliation.totalProduced} <span className="text-sm font-bold text-slate-400">L</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Total Herd Extraction</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
            Delivered to Customers
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
            {reconciliation.totalDelivered} <span className="text-sm font-bold text-emerald-500">L</span>
          </div>
          <div className="text-xs text-emerald-600 mt-0.5">Active Route Drops</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Chilled Tank Reserves
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            {reconciliation.remainingStock} <span className="text-sm font-bold text-slate-400">L</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Curd / Paneer Processing</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Spillage & Own Use
          </div>
          <div className="text-2xl font-black text-slate-800 font-mono mt-1">
            {(reconciliation.wasteOrSpillage + reconciliation.personalConsumption).toFixed(1)}{' '}
            <span className="text-sm font-bold text-slate-400">L</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Accounted Consumption</div>
        </div>
      </div>

      {/* Production Breakdown by Breed */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900">Milking Production Breakdown</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
            <div className="text-xs font-bold text-blue-900">HF & Jersey Cow Milk</div>
            <div className="text-xl font-black text-blue-700 font-mono mt-1">
              {reconciliation.cowMilkProduced} L
            </div>
            <div className="text-[11px] text-blue-600 mt-0.5">Base home subscription milk</div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
            <div className="text-xs font-bold text-emerald-900">Murrah Buffalo Milk</div>
            <div className="text-xl font-black text-emerald-700 font-mono mt-1">
              {reconciliation.buffaloMilkProduced} L
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">High fat premium dairy</div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
            <div className="text-xs font-bold text-amber-900">Gir Cow A2 Vedic Milk</div>
            <div className="text-xl font-black text-amber-700 font-mono mt-1">
              {reconciliation.a2MilkProduced} L
            </div>
            <div className="text-[11px] text-amber-600 mt-0.5">Certified desi organic yield</div>
          </div>
        </div>
      </div>

      {/* Reconciliation Equation Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-600" />
            <span>Daily Mass Balance Equation</span>
          </h3>
          <span
            className={`px-3 py-1 rounded-full text-xs font-black font-mono ${
              reconciliation.status === 'BALANCED'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {reconciliation.status === 'BALANCED'
              ? '✓ PERFECT BALANCE (0 L VARIANCE)'
              : `VARIANCE: ${reconciliation.discrepancy} L`}
          </span>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed">
          <div className="font-bold text-slate-500 mb-1 font-sans text-[11px]">Audit Equation:</div>
          Production ({reconciliation.totalProduced} L) = Delivered ({reconciliation.totalDelivered} L) +
          Remaining Tank ({reconciliation.remainingStock} L) + Waste ({reconciliation.wasteOrSpillage} L) +
          Personal ({reconciliation.personalConsumption} L)
        </div>
      </div>

      {showClosingModal && (
        <EndOfDayClosingModal
          selectedDate={selectedDate}
          totalDelivered={reconciliation.totalDelivered}
          totalExpected={totalExpected}
          skippedCount={skippedCount}
          onClose={() => setShowClosingModal(false)}
          onConfirmCloseDay={handleConfirmCloseDay}
        />
      )}
    </div>
  );
}
