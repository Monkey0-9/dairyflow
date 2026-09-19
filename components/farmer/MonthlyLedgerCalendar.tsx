'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  User,
  Droplets,
  CheckCircle2,
  SkipForward,
  AlertTriangle,
  Clock,
  Edit3,
} from 'lucide-react';
import { CustomerProfile, DeliveryRecord, DeliveryStatus } from '@/lib/types';

interface MonthlyLedgerCalendarProps {
  customers: CustomerProfile[];
  onSelectDate: (date: string) => void;
  onUpdateRecord: (
    recordId: string,
    updates: {
      deliveredQuantity?: number;
      status?: DeliveryStatus;
      reason?: string;
    }
  ) => Promise<void>;
}

export default function MonthlyLedgerCalendar({
  customers,
  onSelectDate,
  onUpdateRecord,
}: MonthlyLedgerCalendarProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [activeDayRecords, setActiveDayRecords] = useState<DeliveryRecord[]>([]);
  const [activeDay, setActiveDay] = useState<string>('2026-09-16');
  const [showDayModal, setShowDayModal] = useState<boolean>(false);
  const [monthCache, setMonthCache] = useState<Record<string, DeliveryRecord[]>>({});
  const [loading, setLoading] = useState(false);
  // Failed quick-edits surface here; local rows only change after the server
  // confirms, so a failed save can never look saved.
  const [dayError, setDayError] = useState<string | null>(null);

  // Month days: September 2026 has 30 days. Sep 1 2026 is Tuesday.
  const daysInMonth = Array.from({ length: 30 }, (_, i) => {
    const dayNum = i + 1;
    const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
    return `2026-09-${dayStr}`;
  });

  // Fetch month deliveries
  useEffect(() => {
    const fetchMonth = async () => {
      setLoading(true);
      try {
        const cache: Record<string, DeliveryRecord[]> = {};
        for (let day = 1; day <= 20; day++) {
          const dStr = `2026-09-${day < 10 ? `0${day}` : day}`;
          const res = await fetch(`/api/ledger?date=${dStr}`);
          const data = await res.json();
          if (data.success) {
            cache[dStr] = data.records;
          }
        }
        setMonthCache(cache);
      } catch (err) {
        console.error('Error fetching calendar data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMonth();
  }, []);

  const openDayDetails = (dateStr: string) => {
    setActiveDay(dateStr);
    setDayError(null);
    const recs = monthCache[dateStr] || [];
    setActiveDayRecords(recs);
    setShowDayModal(true);
  };

  // Apply a quick edit only after the server confirms, and keep the month
  // cache in sync so the edit does not "disappear" when reopening the day.
  const applyQuickEdit = async (
    record: DeliveryRecord,
    updates: { deliveredQuantity?: number; status?: DeliveryStatus; reason?: string }
  ) => {
    setDayError(null);
    try {
      await onUpdateRecord(record.id, updates);
      const next = activeDayRecords.map((x) =>
        x.id === record.id ? { ...x, ...updates } : x
      );
      setActiveDayRecords(next);
      setMonthCache((prev) => ({ ...prev, [activeDay]: next }));
    } catch (err) {
      setDayError(err instanceof Error ? err.message : 'Update failed. Please retry.');
    }
  };

  const getDayStatusSummary = (dateStr: string) => {
    const recs = monthCache[dateStr];
    if (!recs || recs.length === 0) {
      if (dateStr > '2026-09-16') return { symbol: '—', text: 'Scheduled', color: 'text-slate-300' };
      return { symbol: '—', text: 'No Data', color: 'text-slate-300' };
    }

    if (selectedCustomerId !== 'ALL') {
      const custRec = recs.find((r) => r.customerId === selectedCustomerId);
      if (!custRec) return { symbol: '—', text: 'No delivery', color: 'text-slate-300' };

      if (custRec.status === 'SKIPPED') {
        return { symbol: '0', text: '0 L (Skipped)', color: 'text-rose-600 bg-rose-50 border-rose-200' };
      }
      if (custRec.status === 'PARTIAL') {
        return { symbol: '½', text: `${custRec.deliveredQuantity}L (Partial)`, color: 'text-amber-600 bg-amber-50 border-amber-200' };
      }
      if (custRec.status === 'EXTRA') {
        return { symbol: '+', text: `${custRec.deliveredQuantity}L (Extra)`, color: 'text-blue-600 bg-blue-50 border-blue-200' };
      }
      return { symbol: '✓', text: `${custRec.deliveredQuantity}L (Delivered)`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    }

    // All customers aggregate
    let totalDelivered = 0;
    let anySkipped = false;
    let anyDispute = false;

    recs.forEach((r) => {
      totalDelivered += r.deliveredQuantity;
      if (r.status === 'SKIPPED') anySkipped = true;
      if (r.hasDispute) anyDispute = true;
    });

    if (anyDispute) {
      return { symbol: '⚠', text: `${totalDelivered.toFixed(1)}L`, color: 'text-rose-700 bg-rose-50 border-rose-300' };
    }
    if (anySkipped) {
      return { symbol: '✓*', text: `${totalDelivered.toFixed(1)}L (Skips)`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    return { symbol: '✓', text: `${totalDelivered.toFixed(1)}L`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  };

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      {/* Calendar Header & Customer Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-600" />
            <span>Monthly Delivery Calendar</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            September 2026 • Interactive visual ledger grid with audit verification
          </p>
        </div>

        {/* Customer Selector Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">View Customer:</span>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Customers (Aggregate Demand)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.customerCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs font-medium text-slate-600">
        <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
            ✓
          </span>
          <span>Delivered</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-xs">
            0
          </span>
          <span>Skipped (Customer away / Requested 0L)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
            ½
          </span>
          <span>Partial Delivery</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
            +
          </span>
          <span>Extra Quantity</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-xs">
            ⚠
          </span>
          <span>Disputed Delivery</span>
        </span>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden p-6">
        {/* Month Title */}
        <div className="text-center font-extrabold text-slate-900 text-base mb-6">
          SEPTEMBER 2026
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
          {weekdays.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        {/* Grid Cells (Sep 1 is Tuesday, so 1 blank cell before it) */}
        <div className="grid grid-cols-7 gap-2">
          {/* Monday blank placeholder */}
          <div className="aspect-square bg-slate-50/50 rounded-2xl border border-dashed border-slate-100 opacity-40" />

          {daysInMonth.map((dStr, idx) => {
            const dayNum = idx + 1;
            const isToday = dStr === '2026-09-16';
            const status = getDayStatusSummary(dStr);

            return (
              <button
                key={dStr}
                onClick={() => openDayDetails(dStr)}
                className={`aspect-square p-2 rounded-2xl border transition text-left flex flex-col justify-between hover:shadow-md hover:border-emerald-500 group relative ${
                  isToday
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-black font-mono ${
                      isToday
                        ? 'w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center'
                        : 'text-slate-700'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-extrabold uppercase text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">
                      Today
                    </span>
                  )}
                </div>

                {/* Day Content / Symbol */}
                <div className="text-center py-1">
                  <div
                    className={`inline-block px-2 py-0.5 rounded-lg font-black text-xs border ${status.color}`}
                  >
                    {status.symbol}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
                    {status.text}
                  </div>
                </div>

                <div className="text-[9px] text-slate-300 group-hover:text-emerald-600 text-right font-medium">
                  Inspect →
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Inspector & Editor Modal */}
      {showDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Day Delivery Ledger — {activeDay}
                </h3>
                <p className="text-xs text-slate-500">
                  Inspect or modify any customer record for this date
                </p>
              </div>
              <button
                onClick={() => setShowDayModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            {dayError && (
              <div className="mx-6 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <p className="flex-1"><span className="font-bold">Not saved: </span>{dayError}</p>
              </div>
            )}

            <div className="p-6 max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {activeDayRecords.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No records stored yet for {activeDay}. (Click "Jump to Daily Delivery" to auto-generate).
                </div>
              ) : (
                activeDayRecords.map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">
                          {r.customerCode}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{r.customerName}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {r.productName} • Scheduled: {r.scheduledQuantity} L • Rate: ₹{r.pricePerUnit}/L
                      </p>
                      {r.reason && (
                        <p className="text-[10px] text-rose-600 italic mt-0.5">Note: {r.reason}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-slate-900">
                          {r.deliveredQuantity} L
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            r.status === 'DELIVERED' || r.status === 'EXTRA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'SKIPPED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>

                      {/* Quick Edit button for this record */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            applyQuickEdit(r, {
                              deliveredQuantity: r.scheduledQuantity,
                              status: 'DELIVERED',
                              reason: undefined,
                            })
                          }
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold"
                          title="Set as Delivered"
                        >
                          ✓ Delivered
                        </button>
                        <button
                          onClick={() =>
                            applyQuickEdit(r, {
                              deliveredQuantity: 0,
                              status: 'SKIPPED',
                              reason: 'Customer did not take milk',
                            })
                          }
                          className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 rounded-lg text-[10px] font-bold"
                          title="Skip (0L)"
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => {
                  onSelectDate(activeDay);
                  setShowDayModal(false);
                }}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                Open in Full Daily Delivery Screen →
              </button>
              <button
                onClick={() => setShowDayModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
