'use client';

import React, { useState, useMemo } from 'react';
import { Search, Filter, Sun, CheckCircle2, RotateCcw, Droplets } from 'lucide-react';
import { DeliveryRecord } from '@/lib/types';
import { CustomerRow } from './CustomerRow';
import { EmptyState } from '@/components/ui/EmptyState';

export interface MorningRunListProps {
  records: DeliveryRecord[];
  onUpdateDelivery: (
    recordId: string,
    status: 'DELIVERED' | 'SKIPPED' | 'PARTIAL',
    deliveredQty: number,
    bottlesReturned: number,
    notes?: string
  ) => Promise<void>;
  onShowQR?: (record: DeliveryRecord) => void;
  selectedDate: string;
}

export function MorningRunList({
  records,
  onUpdateDelivery,
  onShowQR,
  selectedDate,
}: MorningRunListProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'PENDING' | 'DELIVERED' | 'SKIPPED' | 'DISPUTED'
  >('ALL');
  const [isSunlightMode, setIsSunlightMode] = useState<boolean>(false);
  const [lastUpdatedRecord, setLastUpdatedRecord] = useState<{
    recordId: string;
    previousStatus: string;
    previousQty: number;
    previousBottles: number;
  } | null>(null);

  // Filter and Search logic
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Status filter
      if (filterStatus === 'PENDING') {
        if (r.status === 'DELIVERED' || r.status === 'SKIPPED' || r.status === 'NOT_DELIVERED') return false;
      } else if (filterStatus === 'DELIVERED') {
        if (r.status !== 'DELIVERED' && r.status !== 'PARTIAL') return false;
      } else if (filterStatus === 'SKIPPED') {
        if (r.status !== 'SKIPPED' && r.status !== 'NOT_DELIVERED') return false;
      } else if (filterStatus === 'DISPUTED') {
        if (r.status !== 'DISPUTED' && !r.hasDispute) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.customerName?.toLowerCase().includes(q);
        const matchProduct = r.productName?.toLowerCase().includes(q);
        const matchCode = r.customerCode?.toLowerCase().includes(q);
        return matchName || matchProduct || matchCode;
      }

      return true;
    });
  }, [records, filterStatus, searchQuery]);

  // Operational metrics
  const stats = useMemo(() => {
    let totalScheduled = 0;
    let totalDelivered = 0;
    let deliveredCount = 0;
    let skippedCount = 0;
    let pendingCount = 0;
    let bottlesReturned = 0;

    records.forEach((r) => {
      totalScheduled += r.scheduledQuantity || 0;
      totalDelivered += r.deliveredQuantity || 0;
      bottlesReturned += r.bottlesReturned || 0;
      if (r.status === 'DELIVERED' || r.status === 'PARTIAL') deliveredCount++;
      else if (r.status === 'SKIPPED' || r.status === 'NOT_DELIVERED') skippedCount++;
      else pendingCount++;
    });

    return {
      totalScheduled: parseFloat(totalScheduled.toFixed(1)),
      totalDelivered: parseFloat(totalDelivered.toFixed(1)),
      remainingLitres: parseFloat(Math.max(0, totalScheduled - totalDelivered).toFixed(1)),
      deliveredCount,
      skippedCount,
      pendingCount,
      bottlesReturned,
    };
  }, [records]);

  const handleUpdate = async (
    recordId: string,
    status: 'DELIVERED' | 'SKIPPED' | 'PARTIAL',
    deliveredQty: number,
    bottles: number,
    notes?: string
  ) => {
    const existing = records.find((r) => r.id === recordId);
    if (existing) {
      setLastUpdatedRecord({
        recordId,
        previousStatus: existing.status,
        previousQty: existing.deliveredQuantity,
        previousBottles: existing.bottlesReturned || 0,
      });
    }

    await onUpdateDelivery(recordId, status, deliveredQty, bottles, notes);
  };

  const handleUndo = async () => {
    if (!lastUpdatedRecord) return;
    const { recordId, previousStatus, previousQty, previousBottles } = lastUpdatedRecord;
    setLastUpdatedRecord(null);
    await onUpdateDelivery(
      recordId,
      previousStatus as any,
      previousQty,
      previousBottles,
      'Undo action'
    );
  };

  return (
    <div className={`space-y-4 ${isSunlightMode ? 'sunlight-mode' : ''}`}>
      {/* Top Field Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80">
          <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Delivered</span>
          <div className="text-xl font-black text-emerald-950 mt-0.5">
            {stats.totalDelivered} <span className="text-xs font-bold text-emerald-700">L</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700">
            {stats.deliveredCount} of {records.length} customers
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80">
          <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Remaining</span>
          <div className="text-xl font-black text-amber-950 mt-0.5">
            {stats.remainingLitres} <span className="text-xs font-bold text-amber-700">L</span>
          </div>
          <span className="text-[10px] font-bold text-amber-700">
            {stats.pendingCount} stops pending
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200">
          <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Scheduled</span>
          <div className="text-xl font-black text-slate-900 mt-0.5">
            {stats.totalScheduled} <span className="text-xs font-bold text-slate-500">L</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500">{records.length} total customers</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/80">
          <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider">Bottles</span>
          <div className="text-xl font-black text-blue-950 mt-0.5">
            {stats.bottlesReturned} <span className="text-xs font-bold text-blue-700">returned</span>
          </div>
          <span className="text-[10px] font-bold text-blue-700">Crates &amp; empties</span>
        </div>
      </div>

      {/* Sticky Search & Filter Toolbar */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer name or address..."
              className="w-full pl-9 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Sunlight Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsSunlightMode(!isSunlightMode)}
            className={`p-2 rounded-xl border transition flex items-center gap-1 cursor-pointer text-xs font-bold ${
              isSunlightMode
                ? 'bg-black text-white border-black'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle Sunlight High-Contrast Mode"
          >
            <Sun className="w-4 h-4" />
            <span className="hidden sm:inline">Sunlight</span>
          </button>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 mr-0.5" />

          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({records.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('PENDING')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              filterStatus === 'PENDING'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Pending ({stats.pendingCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('DELIVERED')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              filterStatus === 'DELIVERED'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Delivered ({stats.deliveredCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('SKIPPED')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              filterStatus === 'SKIPPED'
                ? 'bg-slate-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Skipped ({stats.skippedCount})
          </button>
        </div>
      </div>

      {/* Undo Toast Notification */}
      {lastUpdatedRecord && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">Delivery recorded successfully</span>
          <button
            type="button"
            onClick={handleUndo}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* Customer Rows List */}
      <div className="space-y-2.5">
        {filteredRecords.length === 0 ? (
          <EmptyState
            icon={<Droplets className="w-6 h-6 text-slate-400" />}
            title="No Delivery Records Found"
            description={
              searchQuery
                ? `No customers match "${searchQuery}". Try clearing the search query.`
                : `No deliveries matching the "${filterStatus.toLowerCase()}" filter for ${selectedDate}.`
            }
          />
        ) : (
          filteredRecords.map((record) => (
            <CustomerRow
              key={record.id}
              record={record}
              onUpdateDelivery={handleUpdate}
              onShowQR={onShowQR}
              isSunlightMode={isSunlightMode}
            />
          ))
        )}
      </div>
    </div>
  );
}
