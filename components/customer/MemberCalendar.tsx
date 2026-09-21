'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarDays,
  Pause,
  TrendingUp,
  AlertCircle,
  BarChart3,
  Milk,
  IndianRupee,
} from 'lucide-react';

interface DailyEntry {
  date: string;
  dayOfWeek: string;
  dayNumber: number;
  scheduledQty: number;
  takenQty: number;
  pricePerUnit: number;
  dailyAmount: number;
  status: string;
  notes: string | null;
  isPaused: boolean;
  isFuture: boolean;
  isToday: boolean;
  deliveryId: string | null;
}

interface CalendarData {
  customer: { id: string; name: string; milkType: string; dailyQuantity: number; farmerName: string };
  subscription: { productName: string; quantity: number; pricePerUnit: number; frequency: string; status: string } | null;
  month: number;
  year: number;
  totalDays: number;
  dailyEntries: DailyEntry[];
  pausePeriods: { startDate: string; endDate: string; reason: string }[];
  summary: {
    takenDays: number;
    notTakenDays: number;
    pendingDays: number;
    totalLitres: number;
    scheduledLitres: number;
    totalBilling: number;
    averageDailyLitres: number;
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  DELIVERED: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Delivered',
  },
  PARTIAL: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400',
    label: 'Partial',
  },
  EXTRA: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-800',
    text: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
    label: 'Extra',
  },
  SKIPPED: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800',
    text: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-400',
    label: 'Skipped',
  },
  NOT_DELIVERED: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Not Delivered',
  },
  PAUSED: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    border: 'border-slate-200 dark:border-slate-700',
    text: 'text-slate-400 dark:text-slate-500',
    dot: 'bg-slate-300',
    label: 'Paused',
  },
  EXPECTED: {
    bg: 'bg-slate-50 dark:bg-slate-900/40',
    border: 'border-slate-200 dark:border-slate-700',
    text: 'text-slate-500',
    dot: 'bg-slate-300',
    label: 'Expected',
  },
  DISPUTED: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
    label: 'Disputed',
  },
  FUTURE: {
    bg: 'bg-transparent',
    border: 'border-dashed border-slate-200 dark:border-slate-800',
    text: 'text-slate-300 dark:text-slate-700',
    dot: 'bg-slate-200',
    label: 'Upcoming',
  },
};

function getStatusStyle(status: string) {
  return STATUS_STYLE[status] || STATUS_STYLE.EXPECTED;
}

interface DayCellProps {
  entry: DailyEntry;
  onSelect: (entry: DailyEntry) => void;
  isSelected: boolean;
}

function DayCell({ entry, onSelect, isSelected }: DayCellProps) {
  const s = getStatusStyle(entry.status);
  const isTaken = ['DELIVERED', 'PARTIAL', 'EXTRA'].includes(entry.status);
  const isNotTaken = ['SKIPPED', 'NOT_DELIVERED'].includes(entry.status);

  return (
    <button
      type="button"
      onClick={() => !entry.isFuture && onSelect(entry)}
      className={`relative w-full aspect-square sm:aspect-auto sm:h-[76px] rounded-xl border transition-all duration-200 text-left flex flex-col justify-between p-1.5 sm:p-2
        ${s.bg} ${s.border}
        ${entry.isToday ? 'ring-2 ring-amber-400 ring-offset-1' : ''}
        ${isSelected ? 'ring-2 ring-blue-500 shadow-md' : ''}
        ${entry.isFuture ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm hover:scale-[1.02]'}
      `}
      aria-label={`${entry.date}: ${s.label}, ${entry.takenQty}L taken`}
    >
      <div className="flex items-start justify-between gap-0.5">
        <span className={`text-[11px] font-bold leading-none ${s.text} ${entry.isToday ? 'text-amber-500' : ''}`}>
          {entry.dayNumber}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0 ${s.dot}`} />
      </div>

      {!entry.isFuture && entry.status !== 'FUTURE' && (
        <div className={`text-[10px] font-semibold ${s.text} truncate`}>
          {isTaken ? `${entry.takenQty}L` : isNotTaken ? '\u2014' : entry.status === 'PAUSED' ? '\u23F8' : `~${entry.scheduledQty}L`}
        </div>
      )}
    </button>
  );
}

export interface MemberCalendarProps {
  customerId: string;
}

export function MemberCalendar({ customerId }: MemberCalendarProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DailyEntry | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customer/deliveries?month=${month}&year=${year}&customerId=${customerId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load calendar');
      setData(json as CalendarData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [month, year, customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const firstWeekDay = data ? new Date(`${year}-${String(month).padStart(2, '0')}-01`).getDay() : 0;

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center border border-amber-500/30 animate-spin">
          <Droplets className="w-5 h-5" />
        </div>
        <p className="text-xs text-slate-500 font-mono">Loading calendar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-rose-400" />
        <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">{error}</p>
        <button onClick={fetchData} className="text-xs text-blue-500 underline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, dailyEntries, subscription } = data;
  const denominator = summary.takenDays + summary.notTakenDays + summary.pendingDays;
  const takenPct = denominator > 0 ? Math.round((summary.takenDays / denominator) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-500" />
            Delivery Calendar
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Daily milk consumption at a glance</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="min-w-[120px] text-center text-sm font-bold text-slate-800 dark:text-slate-200">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={month === now.getMonth() + 1 && year === now.getFullYear()}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Taken</span>
          </div>
          <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{summary.takenDays}</span>
          <span className="text-[10px] text-emerald-500">days received</span>
        </div>

        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400">
            <XCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Not Taken</span>
          </div>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{summary.notTakenDays}</span>
          <span className="text-[10px] text-rose-400">days skipped</span>
        </div>

        <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
            <Milk className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Litres</span>
          </div>
          <span className="text-2xl font-black text-sky-700 dark:text-sky-300">{summary.totalLitres.toFixed(1)}</span>
          <span className="text-[10px] text-sky-400">consumed this month</span>
        </div>

        <div className="rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900 p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
            <IndianRupee className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Billing</span>
          </div>
          <span className="text-2xl font-black text-violet-700 dark:text-violet-300">&#x20B9;{summary.totalBilling.toFixed(0)}</span>
          <span className="text-[10px] text-violet-400">estimated total</span>
        </div>
      </div>

      {/* Delivery rate bar */}
      {(summary.takenDays + summary.notTakenDays) > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Delivery rate
            </span>
            <span className="font-black text-slate-800 dark:text-slate-100">{takenPct}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${takenPct}%`,
                background: takenPct >= 80 ? '#10b981' : takenPct >= 50 ? '#f59e0b' : '#f43f5e',
              }}
            />
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-400">
            {subscription && (
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                {subscription.productName} &middot; &#x20B9;{subscription.pricePerUnit}/L
              </span>
            )}
            {summary.pendingDays > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {summary.pendingDays} pending
              </span>
            )}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-3.5">
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {Array.from({ length: firstWeekDay }).map((_, i) => (
            <div key={`blank-${i}`} className="aspect-square sm:h-[76px]" />
          ))}

          {dailyEntries.map((entry) => (
            <DayCell
              key={entry.date}
              entry={entry}
              isSelected={selectedDay?.date === entry.date}
              onSelect={setSelectedDay}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-slate-400">
        {[
          { status: 'DELIVERED', label: 'Delivered' },
          { status: 'PARTIAL', label: 'Partial' },
          { status: 'SKIPPED', label: 'Skipped' },
          { status: 'PAUSED', label: 'Paused' },
          { status: 'EXPECTED', label: 'Pending' },
        ].map(({ status, label }) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${getStatusStyle(status).dot}`} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Today
        </span>
      </div>

      {/* Selected day detail */}
      {selectedDay && !selectedDay.isFuture && (
        <div
          className={`rounded-2xl border p-4 space-y-3 transition-all duration-300 ${getStatusStyle(selectedDay.status).bg} ${getStatusStyle(selectedDay.status).border}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {new Date(selectedDay.date + 'T12:00:00').toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${getStatusStyle(selectedDay.status).text} border ${getStatusStyle(selectedDay.status).border}`}>
                  {getStatusStyle(selectedDay.status).label}
                </span>
                {selectedDay.isToday && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                    Today
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
              aria-label="Close detail"
            >
              &times;
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Scheduled</p>
              <p className="text-xl font-black text-slate-700 dark:text-slate-200">{selectedDay.scheduledQty}L</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Received</p>
              <p className={`text-xl font-black ${getStatusStyle(selectedDay.status).text}`}>
                {['SKIPPED', 'NOT_DELIVERED', 'PAUSED'].includes(selectedDay.status) ? '\u2014' : `${selectedDay.takenQty}L`}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Amount</p>
              <p className="text-xl font-black text-slate-700 dark:text-slate-200">
                {selectedDay.dailyAmount > 0 ? `&#x20B9;${selectedDay.dailyAmount.toFixed(2)}` : '\u2014'}
              </p>
            </div>
          </div>

          {selectedDay.notes && (
            <div className="bg-white/60 dark:bg-slate-900/40 rounded-xl p-2.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
              <span className="font-semibold text-slate-500">Note:</span> {selectedDay.notes}
            </div>
          )}

          {selectedDay.isPaused && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Pause className="w-3.5 h-3.5" />
              Delivery paused on this day (vacation or pause request approved)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
