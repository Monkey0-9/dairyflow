'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  SkipForward,
  AlertTriangle,
  PlusCircle,
  XCircle,
  Search,
  Filter,
  QrCode,
  Droplets,
  Clock,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Edit3,
  Calendar,
  Layers,
  MapPin,
  Check,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { DeliveryRecord, DeliveryStatus, CustomerProfile } from '@/lib/types';
import QRScannerModal from '../common/QRScannerModal';
import EndOfDayClosingModal from './EndOfDayClosingModal';

interface FarmerDashboardProps {
  selectedDate: string;
  records: DeliveryRecord[];
  customers: CustomerProfile[];
  stats: {
    customerCount: number;
    totalScheduled: number;
    totalDelivered: number;
    pendingLitres: number;
    deliveredCount: number;
    skippedCount: number;
    partialCount: number;
    disputedCount: number;
  };
  onUpdateRecord: (
    recordId: string,
    updates: {
      deliveredQuantity?: number;
      status?: DeliveryStatus;
      reason?: string;
      notes?: string;
      bottlesReturned?: number;
    }
  ) => Promise<void>;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}

export default function FarmerDashboard({
  selectedDate,
  records,
  customers,
  stats,
  onUpdateRecord,
  onRefresh,
  onNavigateTab,
}: FarmerDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [editingRecord, setEditingRecord] = useState<DeliveryRecord | null>(null);
  const [customQty, setCustomQty] = useState<number>(1);
  const [customStatus, setCustomStatus] = useState<DeliveryStatus>('DELIVERED');
  const [customReason, setCustomReason] = useState('');
  const [customBottles, setCustomBottles] = useState(1);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleConfirmCloseDay = async (formData: {
    cowMilkProduced: number;
    buffaloMilkProduced: number;
    a2MilkProduced: number;
    remainingStock: number;
    wasteOrSpillage: number;
    personalConsumption: number;
  }) => {
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          ...formData,
        }),
      });
      if (res.ok) {
        setShowClosingModal(false);
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to close day', err);
    }
  };

  // Filter records
  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.productName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'DELIVERED') return r.status === 'DELIVERED' || r.status === 'EXTRA';
    if (filterStatus === 'SKIPPED') return r.status === 'SKIPPED';
    if (filterStatus === 'PARTIAL') return r.status === 'PARTIAL';
    if (filterStatus === 'DISPUTED') return r.hasDispute || r.status === 'DISPUTED';
    if (filterStatus === 'PENDING') return r.deliveredQuantity === 0 && r.status !== 'SKIPPED';
    return true;
  });

  // Fast 1-click delivery handler
  const handleQuickDeliver = async (record: DeliveryRecord) => {
    setIsUpdating(true);
    await onUpdateRecord(record.id, {
      deliveredQuantity: record.scheduledQuantity,
      status: 'DELIVERED',
      reason: undefined,
    });
    setIsUpdating(false);
  };

  // Fast 1-click skip handler
  const handleQuickSkip = async (record: DeliveryRecord) => {
    setIsUpdating(true);
    await onUpdateRecord(record.id, {
      deliveredQuantity: 0,
      status: 'SKIPPED',
      reason: 'Customer requested skip',
    });
    setIsUpdating(false);
  };

  // Open Edit Modal
  const openEditModal = (record: DeliveryRecord) => {
    setEditingRecord(record);
    setCustomQty(record.deliveredQuantity);
    setCustomStatus(record.status);
    setCustomReason(record.reason || '');
    setCustomBottles(record.bottlesReturned || 1);
  };

  // Save Edit Modal
  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setIsUpdating(true);
    await onUpdateRecord(editingRecord.id, {
      deliveredQuantity: customStatus === 'SKIPPED' ? 0 : customQty,
      status: customStatus,
      reason: customReason,
      bottlesReturned: customBottles,
    });
    setIsUpdating(false);
    setEditingRecord(null);
  };

  const handleQRScanned = (cust: CustomerProfile) => {
    setShowQRScanner(false);
    const rec = records.find((r) => r.customerId === cust.id);
    if (rec) {
      openEditModal(rec);
    }
  };

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Daily Delivery Command Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">{formattedDate}</span>
            <span>• Morning Delivery Shift (6:00 AM – 8:00 AM)</span>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowClosingModal(true)}
            id="btn-end-of-day-closing"
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
          >
            <Lock className="w-3.5 h-3.5 text-amber-700" />
            <span>End of Day Closing</span>
          </button>

          <button
            onClick={() => setShowQRScanner(true)}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Scan Customer QR</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Customers
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {stats.customerCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active Subscribers</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Expected Milk
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
            {stats.totalScheduled} <span className="text-sm font-bold text-slate-400">L</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Scheduled Demand</div>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
            Delivered Milk
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            {stats.totalDelivered} <span className="text-sm font-bold text-emerald-500">L</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            {stats.deliveredCount} Customers Served
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
            Pending / Remainder
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1 font-mono">
            {stats.pendingLitres} <span className="text-sm font-bold text-amber-500">L</span>
          </div>
          <div className="text-[11px] text-amber-600 font-semibold mt-0.5">Awaiting Drop</div>
        </div>

        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs col-span-2 md:col-span-1">
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
            Exceptions & Skips
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1 font-mono">
            {stats.skippedCount + stats.partialCount}
          </div>
          <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
            {stats.skippedCount} Skipped • {stats.partialCount} Partial
          </div>
        </div>
      </div>

      {/* Control Bar: Search + Filter Chips + Mode Switch */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, code (e.g. Ravi)..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'DELIVERED', label: 'Delivered' },
            { id: 'SKIPPED', label: 'Skipped' },
            { id: 'PARTIAL', label: 'Partial' },
            { id: 'DISPUTED', label: 'Disputed' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                filterStatus === f.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* View Switch */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end md:self-auto">
          <button
            onClick={() => setViewMode('CARDS')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              viewMode === 'CARDS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            Touch Cards
          </button>
          <button
            onClick={() => setViewMode('TABLE')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            Table Ledger
          </button>
        </div>
      </div>

      {/* Main Delivery Records View */}
      {viewMode === 'CARDS' ? (
        /* Mobile-First Touch Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRecords.map((record) => {
            const isDelivered = record.status === 'DELIVERED' || record.status === 'EXTRA';
            const isSkipped = record.status === 'SKIPPED';
            const isPartial = record.status === 'PARTIAL';
            const isDisputed = record.hasDispute || record.status === 'DISPUTED';

            return (
              <div
                key={record.id}
                className={`bg-white rounded-3xl p-5 border transition-all duration-200 shadow-xs hover:shadow-md relative overflow-hidden ${
                  isDisputed
                    ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-300/40'
                    : isSkipped
                    ? 'border-slate-200 bg-slate-50/60 opacity-90'
                    : isDelivered
                    ? 'border-emerald-200/90 bg-emerald-50/10'
                    : 'border-slate-200'
                }`}
              >
                {/* Top Row: Customer Code, Name, Time */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        {record.customerCode}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">{record.customerName}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{record.productName}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">
                        {record.scheduledQuantity} L scheduled
                      </span>
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="text-right">
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        isDisputed
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : isSkipped
                          ? 'bg-slate-200 text-slate-700'
                          : isPartial
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : isDelivered
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {record.status}
                    </span>
                    <div className="text-[11px] font-mono text-slate-500 mt-1">
                      {record.deliveredQuantity} L recorded
                    </div>
                  </div>
                </div>

                {/* Reason Note (if skipped or partial or dispute) */}
                {record.reason && (
                  <div className="mt-3 p-2 rounded-xl bg-slate-100/90 text-[11px] text-slate-700 flex items-center gap-1.5">
                    <span className="font-bold text-slate-500">Note:</span>
                    <span className="italic truncate">{record.reason}</span>
                  </div>
                )}

                {/* Dispute Alert Banner */}
                {isDisputed && (
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-100 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Customer claims 0 L delivered</span>
                    </div>
                    <button
                      onClick={() => onNavigateTab('disputes')}
                      className="text-[11px] font-extrabold underline text-rose-900"
                    >
                      Resolve
                    </button>
                  </div>
                )}

                {/* Quick Action Buttons (Mobile-first fast delivery) */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleQuickDeliver(record)}
                    disabled={isUpdating}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      isDelivered && !isPartial
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✓ Delivered</span>
                  </button>

                  <button
                    onClick={() => handleQuickSkip(record)}
                    disabled={isUpdating}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      isSkipped
                        ? 'bg-rose-700 text-white'
                        : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700'
                    }`}
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>⏭ Skip (0L)</span>
                  </button>

                  <button
                    onClick={() => openEditModal(record)}
                    className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1.5 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Qty</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Dense Table Ledger View */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Seq & Code</th>
                  <th className="px-5 py-3.5">Customer Name</th>
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-5 py-3.5 text-center">Scheduled</th>
                  <th className="px-5 py-3.5 text-center">Delivered</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5">Billable Amount</th>
                  <th className="px-5 py-3.5">Reason / Note</th>
                  <th className="px-5 py-3.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3 font-mono font-bold text-slate-400">
                      #{idx + 1} {r.customerCode}
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-900">{r.customerName}</td>
                    <td className="px-5 py-3 text-slate-600">{r.productName}</td>
                    <td className="px-5 py-3 text-center font-mono font-semibold text-slate-700">
                      {r.scheduledQuantity} L
                    </td>
                    <td className="px-5 py-3 text-center font-mono font-bold text-slate-900">
                      {r.deliveredQuantity} L
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          r.status === 'DELIVERED' || r.status === 'EXTRA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'SKIPPED'
                            ? 'bg-slate-200 text-slate-700'
                            : r.status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono font-bold text-slate-900">
                      ₹{r.billableAmount.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-slate-500 italic max-w-xs truncate">
                      {r.reason || '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleQuickDeliver(r)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[11px] transition"
                        >
                          ✓ Deliver
                        </button>
                        <button
                          onClick={() => handleQuickSkip(r)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 font-bold text-[11px] transition"
                        >
                          Skip
                        </button>
                        <button
                          onClick={() => openEditModal(r)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-[11px] transition"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Record Edit Modal (The "Edit Anything" Mechanism) */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Daily Ledger Record Editor
                </h3>
                <p className="text-xs text-slate-500">
                  {editingRecord.customerName} ({editingRecord.customerCode}) • {selectedDate}
                </p>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Scheduled reference */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">Subscribed Expected Quantity:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {editingRecord.scheduledQuantity} L ({editingRecord.productName})
                </span>
              </div>

              {/* Delivered Quantity Stepper */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Actual Delivered Quantity (Litres):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomQty(Math.max(0, parseFloat((customQty - 0.5).toFixed(1))));
                      if (customQty - 0.5 === 0) setCustomStatus('SKIPPED');
                      else if (customQty - 0.5 < editingRecord.scheduledQuantity) setCustomStatus('PARTIAL');
                    }}
                    className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 font-bold text-base hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={customQty}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCustomQty(val);
                      if (val === 0) setCustomStatus('SKIPPED');
                      else if (val < editingRecord.scheduledQuantity) setCustomStatus('PARTIAL');
                      else if (val > editingRecord.scheduledQuantity) setCustomStatus('EXTRA');
                      else setCustomStatus('DELIVERED');
                    }}
                    className="flex-1 text-center py-2 text-base font-black font-mono border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomQty(parseFloat((customQty + 0.5).toFixed(1)));
                      if (customQty + 0.5 > editingRecord.scheduledQuantity) setCustomStatus('EXTRA');
                      else setCustomStatus('DELIVERED');
                    }}
                    className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 font-bold text-base hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Quick Preset Pills */}
              <div className="flex gap-2">
                {[0, 0.5, 1.0, 1.5, 2.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCustomQty(preset);
                      if (preset === 0) setCustomStatus('SKIPPED');
                      else if (preset < editingRecord.scheduledQuantity) setCustomStatus('PARTIAL');
                      else if (preset > editingRecord.scheduledQuantity) setCustomStatus('EXTRA');
                      else setCustomStatus('DELIVERED');
                    }}
                    className={`flex-1 py-1 rounded-lg font-mono font-bold text-xs border ${
                      customQty === preset
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {preset}L
                  </button>
                ))}
              </div>

              {/* Status Selector */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Delivery Status:</label>
                <select
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value as DeliveryStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                >
                  <option value="DELIVERED">🟢 DELIVERED (Billable: YES)</option>
                  <option value="PARTIAL">🟡 PARTIAL (Billable: ACTUAL)</option>
                  <option value="SKIPPED">🔴 SKIPPED (Billable: NO)</option>
                  <option value="EXTRA">🔵 EXTRA (Billable: ACTUAL)</option>
                  <option value="NOT_DELIVERED">⚫ NOT DELIVERED (Farmer unavailable)</option>
                </select>
              </div>

              {/* Reason / Exception Note */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Reason for Exception / Audit Note:
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="e.g. Customer requested skip, Vacation, Out of town..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Bottle returned counter */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Empty Bottles Collected:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomBottles(Math.max(0, customBottles - 1))}
                    className="w-7 h-7 rounded-lg border border-slate-200 bg-white font-bold"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-mono font-bold text-sm">
                    {customBottles}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomBottles(customBottles + 1)}
                    className="w-7 h-7 rounded-lg border border-slate-200 bg-white font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Bill preview */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex justify-between items-center">
                <span>Auto-Recalculated Day Bill:</span>
                <span className="font-mono font-black text-base">
                  ₹{customStatus === 'SKIPPED' ? '0.00' : (customQty * editingRecord.pricePerUnit).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isUpdating}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
              >
                Save & Recalculate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal
          customers={customers}
          onScanSuccess={handleQRScanned}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {/* End of Day Closing Modal */}
      {showClosingModal && (
        <EndOfDayClosingModal
          selectedDate={selectedDate}
          totalDelivered={stats.totalDelivered}
          totalExpected={stats.totalScheduled}
          skippedCount={stats.skippedCount}
          onClose={() => setShowClosingModal(false)}
          onConfirmCloseDay={handleConfirmCloseDay}
        />
      )}
    </div>
  );
}
