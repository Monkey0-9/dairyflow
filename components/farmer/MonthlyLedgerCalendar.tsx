'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  User,
  Droplets,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  Check,
  X,
  Phone,
  TrendingUp,
  CheckCheck,
} from 'lucide-react';
import {
  CustomerProfile,
  DeliveryRecord,
  DeliveryStatus,
  Product,
  PauseRequest,
  ExtraMilkRequest,
} from '@/lib/types';
import { useMilkFlowEvents, playNotificationChime } from '@/lib/use-milkflow-events';
import type { MilkFlowEvent } from '@/lib/events';

export interface MonthlyLedgerCalendarProps {
  customers: CustomerProfile[];
  products?: Product[];
  pauseRequests?: PauseRequest[];
  extraRequests?: ExtraMilkRequest[];
  onSelectDate: (date: string) => void;
  onUpdateRecord: (
    recordId: string,
    updates: {
      deliveredQuantity?: number;
      status?: DeliveryStatus;
      reason?: string;
      notes?: string;
      bottlesReturned?: number;
      customerId?: string;
      date?: string;
      productId?: string;
      scheduledQuantity?: number;
      pricePerUnit?: number;
    }
  ) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}

interface DayCustomerPlan {
  id: string; // real record ID or synthetic `sched_${date}_${customerId}`
  customerId: string;
  customerName: string;
  customerCode: string;
  phone?: string;
  address?: string;
  date: string;
  scheduledQuantity: number;
  deliveredQuantity: number;
  status: DeliveryStatus;
  notes?: string;
  productName: string;
  pricePerUnit: number;
  isVirtual: boolean;
  isVacation: boolean;
  extraRequestedQty: number;
  deliveredAt?: string | null;
}

export default function MonthlyLedgerCalendar({
  customers,
  products = [],
  pauseRequests = [],
  extraRequests = [],
  onSelectDate,
  onUpdateRecord,
  onRefresh,
}: MonthlyLedgerCalendarProps) {
  // Navigation & View State
  // Initialise to the current calendar month & today
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1); // 1-indexed
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK'>('MONTH');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Month Deliveries Cache: key is 'YYYY-MM-DD', value is array of records
  const [monthCache, setMonthCache] = useState<Record<string, DeliveryRecord[]>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Day Inspector & Manual Editor Modal
  const [activeDay, setActiveDay] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [showDayModal, setShowDayModal] = useState<boolean>(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);
  const [autoFulfilling, setAutoFulfilling] = useState<boolean>(false);

  // Ad-Hoc Delivery Form State
  const [showAddAdHoc, setShowAddAdHoc] = useState<boolean>(false);
  const [adHocCustomerId, setAdHocCustomerId] = useState<string>('');
  const [adHocProductId, setAdHocProductId] = useState<string>('');
  const [adHocQuantity, setAdHocQuantity] = useState<string>('1.0');
  const [adHocNotes, setAdHocNotes] = useState<string>('');
  const [adHocSubmitting, setAdHocSubmitting] = useState<boolean>(false);

  // Local draft states for items in the Day Inspector
  const [dayDrafts, setDayDrafts] = useState<
    Record<
      string,
      {
        deliveredQuantity: number;
        status: DeliveryStatus;
        notes: string;
      }
    >
  >({});

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Batch fetch deliveries for the selected month
  const fetchMonthDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const yearStr = String(selectedYear);
      const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : String(selectedMonth);
      const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
      const fromDate = `${yearStr}-${monthStr}-01`;
      const toDate = `${yearStr}-${monthStr}-${totalDays < 10 ? `0${totalDays}` : totalDays}`;

      const res = await fetch(`/api/ledger?from=${fromDate}&to=${toDate}`);
      const data = await res.json();
      const newCache: Record<string, DeliveryRecord[]> = {};

      if (data.success && Array.isArray(data.records)) {
        data.records.forEach((rec: DeliveryRecord) => {
          if (!newCache[rec.date]) newCache[rec.date] = [];
          newCache[rec.date].push(rec);
        });
      }

      // If range returns few records, also ensure active days are pre-cached
      setMonthCache(newCache);
    } catch (err) {
      console.error('[MonthlyLedgerCalendar] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchMonthDeliveries();
  }, [fetchMonthDeliveries]);

  // Live SSE listener for real-time delivery confirmations and request approvals
  const handleLiveEvent = useCallback(
    (ev: MilkFlowEvent) => {
      if (
        ev.type === 'delivery:updated' ||
        ev.type === 'request:approved' ||
        ev.type === 'request:rejected' ||
        ev.type === 'payment:received'
      ) {
        playNotificationChime();
        fetchMonthDeliveries();
      }
    },
    [fetchMonthDeliveries]
  );

  useMilkFlowEvents(handleLiveEvent);

  // Month Navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleGoToday = () => {
    // September 2026 matches seed system date
    setSelectedYear(2026);
    setSelectedMonth(9);
    openDayDetails('2026-09-20');
  };

  // Helper to compute planned vs actual delivery plan for a single date
  const computeDayCustomerPlans = useCallback(
    (dateStr: string): DayCustomerPlan[] => {
      const recorded = monthCache[dateStr] || [];
      const recordedMap = new Map<string, DeliveryRecord>();
      recorded.forEach((r) => recordedMap.set(r.customerId, r));

      const activeCustomers = customers.filter((c) => c.active !== false);

      const plans: DayCustomerPlan[] = activeCustomers.map((cust) => {
        const existingRecord = recordedMap.get(cust.id);

        // Check for Vacation Pause
        const isVacation = pauseRequests.some(
          (p) =>
            p.customerId === cust.id &&
            p.status === 'APPROVED' &&
            dateStr >= p.startDate &&
            dateStr <= p.endDate
        );

        // Check for Extra Milk Request
        const extraReq = extraRequests.find(
          (e) => e.customerId === cust.id && e.status === 'APPROVED' && e.date === dateStr
        );
        const extraQty = extraReq ? Math.max(0, extraReq.requestedQuantity - extraReq.normalQuantity) : 0;

        // Base quantity (defaults to 1.0 or derived from previous recorded delivery)
        const baseQty = existingRecord?.scheduledQuantity ?? 1.0;
        const finalScheduled = isVacation ? 0 : baseQty + extraQty;

        if (existingRecord) {
          return {
            id: existingRecord.id,
            customerId: cust.id,
            customerName: cust.name,
            customerCode: cust.customerCode,
            phone: cust.phone,
            address: cust.address,
            date: dateStr,
            scheduledQuantity: existingRecord.scheduledQuantity,
            deliveredQuantity: existingRecord.deliveredQuantity,
            status: existingRecord.status,
            notes: existingRecord.notes || '',
            productName: existingRecord.productName || 'A2 Cow Milk',
            pricePerUnit: existingRecord.pricePerUnit || 50,
            isVirtual: false,
            isVacation,
            extraRequestedQty: extraQty,
            deliveredAt: existingRecord.deliveredAt,
          };
        }

        // Virtual plan when record is not yet in DB
        const prod = products[0];
        return {
          id: `sched_${dateStr}_${cust.id}`,
          customerId: cust.id,
          customerName: cust.name,
          customerCode: cust.customerCode,
          phone: cust.phone,
          address: cust.address,
          date: dateStr,
          scheduledQuantity: finalScheduled,
          deliveredQuantity: 0,
          status: isVacation ? 'SKIPPED' : 'EXPECTED',
          notes: isVacation ? 'Vacation pause (0L scheduled)' : extraQty > 0 ? `+${extraQty}L extra approved` : '',
          productName: prod?.name || 'A2 Desi Cow Milk',
          pricePerUnit: prod?.basePrice || 50,
          isVirtual: true,
          isVacation,
          extraRequestedQty: extraQty,
          deliveredAt: null,
        };
      });

      return plans;
    },
    [monthCache, customers, pauseRequests, extraRequests, products]
  );

  // Open Day Inspector Modal
  const openDayDetails = (dateStr: string) => {
    setActiveDay(dateStr);
    setDayError(null);
    setShowAddAdHoc(false);
    const plans = computeDayCustomerPlans(dateStr);
    const initialDrafts: Record<string, { deliveredQuantity: number; status: DeliveryStatus; notes: string }> = {};

    plans.forEach((p) => {
      initialDrafts[p.customerId] = {
        deliveredQuantity: p.isVirtual ? p.scheduledQuantity : p.deliveredQuantity,
        status: p.isVirtual ? (p.isVacation ? 'SKIPPED' : 'DELIVERED') : p.status,
        notes: p.notes || '',
      };
    });

    setDayDrafts(initialDrafts);
    setShowDayModal(true);
  };

  // Quick edit or save single customer delivery in Day Modal
  const handleSaveCustomerDelivery = async (plan: DayCustomerPlan) => {
    const draft = dayDrafts[plan.customerId] || {
      deliveredQuantity: plan.deliveredQuantity,
      status: plan.status,
      notes: plan.notes || '',
    };

    setSavingRecordId(plan.customerId);
    setDayError(null);

    try {
      await onUpdateRecord(plan.id, {
        deliveredQuantity: draft.deliveredQuantity,
        status: draft.status,
        notes: draft.notes,
        reason: draft.notes,
        customerId: plan.customerId,
        date: activeDay,
        scheduledQuantity: plan.scheduledQuantity,
        pricePerUnit: plan.pricePerUnit,
      });

      // Update local month cache immediately
      const custObj = customers.find((c) => c.id === plan.customerId);
      const updatedRec: DeliveryRecord = {
        id: plan.isVirtual ? `rec_${activeDay}_${plan.customerId}` : plan.id,
        tenantId: custObj?.tenantId || '',
        farmerId: custObj?.farmerId || '',
        customerId: plan.customerId,
        customerName: plan.customerName,
        customerCode: plan.customerCode,
        productId: 'prod_cow_milk',
        date: activeDay,
        scheduledQuantity: plan.scheduledQuantity,
        deliveredQuantity: draft.deliveredQuantity,
        pricePerUnit: plan.pricePerUnit,
        billableAmount: draft.deliveredQuantity * plan.pricePerUnit,
        status: draft.status,
        notes: draft.notes,
        deliveredAt: new Date().toISOString(),
        productName: plan.productName,
        shift: 'MORNING',
        markedBy: 'FARMER',
        updatedAt: new Date().toISOString(),
      };

      setMonthCache((prev) => {
        const existingList = prev[activeDay] || [];
        const filtered = existingList.filter((r) => r.customerId !== plan.customerId);
        return {
          ...prev,
          [activeDay]: [...filtered, updatedRec],
        };
      });

      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setDayError(err instanceof Error ? err.message : 'Failed to update delivery');
    } finally {
      setSavingRecordId(null);
    }
  };

  // 1-Click Auto Fulfill All Scheduled Deliveries for the active day
  const handleAutoFulfillAll = async () => {
    const plans = computeDayCustomerPlans(activeDay);
    const toFulfill = plans.filter((p) => p.status !== 'SKIPPED' && !p.isVacation);

    if (toFulfill.length === 0) return;

    setAutoFulfilling(true);
    setDayError(null);

    try {
      for (const p of toFulfill) {
        await onUpdateRecord(p.id, {
          deliveredQuantity: p.scheduledQuantity,
          status: 'DELIVERED',
          customerId: p.customerId,
          date: activeDay,
          scheduledQuantity: p.scheduledQuantity,
          pricePerUnit: p.pricePerUnit,
          notes: 'Auto-fulfilled via Calendar',
        });
      }

      await fetchMonthDeliveries();
      if (onRefresh) onRefresh();
      setShowDayModal(false);
    } catch (err: unknown) {
      setDayError(err instanceof Error ? err.message : 'Auto-fulfill failed partially');
    } finally {
      setAutoFulfilling(false);
    }
  };

  // Add Ad-Hoc / Spot Delivery for a customer
  const handleCreateAdHocDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adHocCustomerId) {
      setDayError('Please select a client for ad-hoc delivery.');
      return;
    }
    const qty = parseFloat(adHocQuantity);
    if (isNaN(qty) || qty <= 0) {
      setDayError('Enter a valid quantity greater than 0 L.');
      return;
    }

    setAdHocSubmitting(true);
    setDayError(null);

    try {
      const prod = products.find((p) => p.id === adHocProductId) || products[0];

      await onUpdateRecord(`adhoc_${activeDay}_${adHocCustomerId}`, {
        customerId: adHocCustomerId,
        date: activeDay,
        scheduledQuantity: qty,
        deliveredQuantity: qty,
        status: 'DELIVERED',
        notes: adHocNotes ? `Ad-hoc spot delivery: ${adHocNotes}` : 'Ad-hoc spot delivery',
        pricePerUnit: prod?.basePrice || 50,
      });

      setShowAddAdHoc(false);
      setAdHocNotes('');
      await fetchMonthDeliveries();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setDayError(err instanceof Error ? err.message : 'Failed to record spot delivery.');
    } finally {
      setAdHocSubmitting(false);
    }
  };

  // Month Metrics Calculation
  const monthStats = useMemo(() => {
    let totalScheduled = 0;
    let totalDelivered = 0;
    let daysWithDeliveries = 0;

    const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
    for (let day = 1; day <= totalDays; day++) {
      const dStr = `${selectedYear}-${selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth}-${day < 10 ? `0${day}` : day}`;
      const recs = monthCache[dStr] || [];

      if (recs.length > 0) {
        daysWithDeliveries++;
        recs.forEach((r) => {
          if (selectedCustomerId === 'ALL' || r.customerId === selectedCustomerId) {
            totalScheduled += r.scheduledQuantity || 0;
            totalDelivered += r.deliveredQuantity || 0;
          }
        });
      } else {
        // Estimate scheduled from active customers if future day
        const activeCusts = selectedCustomerId === 'ALL' ? customers : customers.filter((c) => c.id === selectedCustomerId);
        activeCusts.forEach(() => {
          totalScheduled += 1.0;
        });
      }
    }

    const completionRate = totalScheduled > 0 ? Math.min(100, (totalDelivered / totalScheduled) * 100) : 0;
    return {
      totalScheduled: parseFloat(totalScheduled.toFixed(1)),
      totalDelivered: parseFloat(totalDelivered.toFixed(1)),
      completionRate: parseFloat(completionRate.toFixed(1)),
      daysWithDeliveries,
    };
  }, [selectedYear, selectedMonth, monthCache, selectedCustomerId, customers]);

  // Calendar Grid Days Builder
  const calendarDays = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstDayOfWeek = new Date(selectedYear, selectedMonth - 1, 1).getDay();
    // In India/Europe, Monday is first day of week. Monday=1, Sunday=0 -> leading blanks
    const leadingBlanks = (firstDayOfWeek + 6) % 7;

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    for (let i = 0; i < leadingBlanks; i++) {
      days.push({ dateStr: `blank_${i}`, dayNum: 0, isCurrentMonth: false });
    }

    for (let day = 1; day <= totalDays; day++) {
      const dStr = `${selectedYear}-${selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth}-${day < 10 ? `0${day}` : day}`;
      days.push({ dateStr: dStr, dayNum: day, isCurrentMonth: true });
    }

    return days;
  }, [selectedYear, selectedMonth]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery));
      return matchesSearch;
    });
  }, [customers, searchQuery]);

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Estate Operations & Delivery Calendar</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                    Real-Time Sync
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Track who receives which quantity on every date • Instant manual & automatic updates
                </p>
              </div>
            </div>
          </div>

          {/* Month Navigator & View Switcher */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Prev / Month / Next */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl hover:bg-white text-slate-700 hover:shadow-xs transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-xs font-black text-slate-900 font-mono">
                {monthNames[selectedMonth - 1]} {selectedYear}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl hover:bg-white text-slate-700 hover:shadow-xs transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoToday}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-white hover:text-emerald-700 text-slate-700 border border-slate-200 shadow-2xs transition cursor-pointer"
            >
              Today
            </button>

            {/* View Mode Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('MONTH')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'MONTH'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Month Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('WEEK')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === 'WEEK'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly Matrix
              </button>
            </div>

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                fetchMonthDeliveries();
              }}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-white hover:text-emerald-600 border border-slate-200 transition cursor-pointer"
              title="Refresh Month Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client name, code (e.g. MK-001), or phone..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium border border-slate-200 bg-slate-50/80 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Client:
            </span>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Clients ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.customerCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Month KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Month Demand</span>
            <Droplets className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {monthStats.totalScheduled}
            </span>
            <span className="text-xs font-bold text-slate-500">Litres</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Planned base subscriptions</p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Delivered Volume</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {monthStats.totalDelivered}
            </span>
            <span className="text-xs font-bold text-slate-500">Litres</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Confirmed delivery records</p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Fulfillment Rate</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-700 font-mono">
              {monthStats.completionRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, monthStats.completionRate)}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Active Clients</span>
            <User className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {customers.filter((c) => c.active !== false).length}
            </span>
            <span className="text-xs font-bold text-slate-500">accounts</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Live single-estate subscriptions</p>
        </div>
      </div>

      {/* 3. Main View: Month Calendar Grid */}
      {viewMode === 'MONTH' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden p-5 sm:p-6 space-y-4">
          {/* Weekdays Header */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-slate-500 uppercase tracking-wider">
            {weekdays.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((item, idx) => {
              if (!item.isCurrentMonth) {
                return (
                  <div
                    key={`blank_${idx}`}
                    className="aspect-square bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/60 opacity-40"
                  />
                );
              }

              const dStr = item.dateStr;
              const isToday = dStr === '2026-09-20'; // Current system anchor date
              const recs = monthCache[dStr] || [];

              // Calculate day volume
              let daySched = 0;
              let dayDeliv = 0;
              let anySkipped = false;
              let anyExtra = false;

              if (selectedCustomerId === 'ALL') {
                recs.forEach((r) => {
                  daySched += r.scheduledQuantity || 0;
                  dayDeliv += r.deliveredQuantity || 0;
                  if (r.status === 'SKIPPED') anySkipped = true;
                  if (r.status === 'EXTRA') anyExtra = true;
                });
                if (recs.length === 0) {
                  daySched = customers.length * 1.0;
                }
              } else {
                const targetRec = recs.find((r) => r.customerId === selectedCustomerId);
                if (targetRec) {
                  daySched = targetRec.scheduledQuantity;
                  dayDeliv = targetRec.deliveredQuantity;
                  if (targetRec.status === 'SKIPPED') anySkipped = true;
                  if (targetRec.status === 'EXTRA') anyExtra = true;
                } else {
                  daySched = 1.0;
                }
              }

              const isFulfilled = dayDeliv > 0 && dayDeliv >= daySched;
              const isPartial = dayDeliv > 0 && dayDeliv < daySched;
              const hasRecords = recs.length > 0;

              return (
                <button
                  type="button"
                  key={dStr}
                  onClick={() => openDayDetails(dStr)}
                  className={`aspect-square p-2.5 rounded-2xl border transition text-left flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] hover:border-emerald-500 group relative cursor-pointer ${
                    isToday
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40'
                      : hasRecords
                      ? 'border-slate-200 bg-white shadow-2xs hover:border-emerald-500'
                      : 'border-slate-200/70 bg-slate-50/50 hover:bg-white hover:border-emerald-400'
                  }`}
                >
                  {/* Top: Day number & Badge */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-black font-mono ${
                        isToday
                          ? 'w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs'
                          : 'text-slate-900'
                      }`}
                    >
                      {item.dayNum}
                    </span>

                    {isToday && (
                      <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded">
                        Today
                      </span>
                    )}

                    {anySkipped && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-rose-100 text-rose-800 font-bold" title="Skipped/Vacation pause">
                        0L
                      </span>
                    )}

                    {anyExtra && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-800 font-bold" title="Extra milk delivered">
                        +L
                      </span>
                    )}
                  </div>

                  {/* Middle: Litres Details */}
                  <div className="py-1">
                    <div className="flex items-baseline gap-1 font-mono">
                      <span className="text-sm font-black text-slate-900">
                        {dayDeliv > 0 ? dayDeliv.toFixed(1) : daySched.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">L</span>
                    </div>

                    {/* Status Pill */}
                    <div className="mt-1">
                      {isFulfilled ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                          <Check className="w-2.5 h-2.5" /> Delivered
                        </span>
                      ) : isPartial ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                          ½ Partial
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-500 font-mono">
                          {hasRecords ? '0L Skipped' : 'Scheduled'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Client count or edit cue */}
                  <div className="text-[9px] text-slate-500 group-hover:text-emerald-700 font-bold flex items-center justify-between">
                    <span>{hasRecords ? `${recs.length} records` : 'Auto-plan'}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition">Edit →</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Weekly Matrix View ("Who on which date at what quantity") */}
      {viewMode === 'WEEK' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-x-auto">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Customer Delivery Matrix — Current Week
              </h3>
              <p className="text-xs text-slate-500">
                Track each client's quantity day-by-day. Click any quantity cell to adjust in real-time.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              15 Sep – 21 Sep 2026
            </span>
          </div>

          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-3 text-center">Mon (15)</th>
                <th className="py-3 px-3 text-center">Tue (16)</th>
                <th className="py-3 px-3 text-center">Wed (17)</th>
                <th className="py-3 px-3 text-center">Thu (18)</th>
                <th className="py-3 px-3 text-center">Fri (19)</th>
                <th className="py-3 px-3 text-center bg-emerald-50 text-emerald-800 font-black">
                  Sat (20) Today
                </th>
                <th className="py-3 px-3 text-center">Sun (21)</th>
                <th className="py-3 px-4 text-right">Week Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredCustomers.map((cust) => {
                const weekDates = [
                  '2026-09-15', '2026-09-16', '2026-09-17',
                  '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21',
                ];

                let customerWeekTotal = 0;

                return (
                  <tr key={cust.id} className="hover:bg-slate-50/90 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {cust.customerCode}
                        </span>
                        <span>{cust.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                        {cust.address || 'Standard Estate Route'}
                      </div>
                    </td>

                    {weekDates.map((dStr) => {
                      const recs = monthCache[dStr] || [];
                      const rec = recs.find((r) => r.customerId === cust.id);
                      const qty = rec ? rec.deliveredQuantity : 1.0;
                      customerWeekTotal += qty;
                      const isDelivered = rec?.status === 'DELIVERED' || rec?.status === 'EXTRA';
                      const isSkipped = rec?.status === 'SKIPPED';

                      return (
                        <td key={dStr} className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => openDayDetails(dStr)}
                            className={`px-2.5 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer border ${
                              isDelivered
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isSkipped
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                            }`}
                            title={`Click to inspect or change ${cust.name}'s quantity for ${dStr}`}
                          >
                            {qty.toFixed(1)}L
                          </button>
                        </td>
                      );
                    })}

                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                      {customerWeekTotal.toFixed(1)} L
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Day Inspector & Real-Time Quantity Manager Modal */}
      {showDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">
                    Delivery Management — {activeDay}
                  </h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Live System Sync
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Track and adjust individual customer quantities. Changes update invoices and client accounts immediately.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoFulfillAll}
                  disabled={autoFulfilling}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Mark all scheduled deliveries for this day as fulfilled"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>{autoFulfilling ? 'Fulfilling...' : 'Fulfill All Scheduled'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDayModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {dayError && (
              <div className="mx-6 mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{dayError}</span>
              </div>
            )}

            {/* Day Metrics & Sub-Bar */}
            <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-slate-600 font-medium">
                <span>
                  Active Plans: <strong className="text-slate-900">{computeDayCustomerPlans(activeDay).length}</strong>
                </span>
                <span>•</span>
                <span>
                  Delivered:{' '}
                  <strong className="text-emerald-700 font-bold">
                    {computeDayCustomerPlans(activeDay).filter((p) => p.status === 'DELIVERED').length}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Skipped / Paused:{' '}
                  <strong className="text-rose-700 font-bold">
                    {computeDayCustomerPlans(activeDay).filter((p) => p.status === 'SKIPPED').length}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowAddAdHoc(!showAddAdHoc)}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddAdHoc ? 'Hide Spot Delivery Form' : '+ Add Ad-Hoc / Spot Delivery'}</span>
              </button>
            </div>

            {/* Collapsible Ad-Hoc Delivery Form */}
            {showAddAdHoc && (
              <form
                onSubmit={handleCreateAdHocDelivery}
                className="p-5 bg-emerald-50/50 border-b border-emerald-100 grid grid-cols-1 sm:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-150"
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Select Client
                  </label>
                  <select
                    value={adHocCustomerId}
                    onChange={(e) => setAdHocCustomerId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900"
                    required
                  >
                    <option value="">Choose client...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customerCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Product
                  </label>
                  <select
                    value={adHocProductId}
                    onChange={(e) => setAdHocProductId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.basePrice}/L)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Quantity (L)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={adHocQuantity}
                    onChange={(e) => setAdHocQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 font-mono"
                    required
                  />
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    disabled={adHocSubmitting}
                    className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    {adHocSubmitting ? 'Saving...' : 'Record Spot Delivery'}
                  </button>
                </div>
              </form>
            )}

            {/* Customer List (Who, On Which Date, At What Quantity) */}
            <div className="p-6 overflow-y-auto divide-y divide-slate-100 flex-1 space-y-4">
              {computeDayCustomerPlans(activeDay).map((plan) => {
                const draft = dayDrafts[plan.customerId] || {
                  deliveredQuantity: plan.deliveredQuantity,
                  status: plan.status,
                  notes: plan.notes || '',
                };

                const isSaving = savingRecordId === plan.customerId;

                return (
                  <div key={plan.customerId} className="pt-4 first:pt-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    {/* Customer Info Column */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {plan.customerCode}
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          {plan.customerName}
                        </span>

                        {plan.isVacation && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            🏖️ Vacation (0L)
                          </span>
                        )}

                        {plan.extraRequestedQty > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            ✨ +{plan.extraRequestedQty}L Extra
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                        <span>{plan.productName} • ₹{plan.pricePerUnit}/L</span>
                        <span>•</span>
                        <span>Scheduled: <strong className="font-mono text-slate-800">{plan.scheduledQuantity} L</strong></span>
                        {plan.phone && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {plan.phone}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Manual Quantity Editor & Status Controls */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                      {/* Quantity Stepper & Input */}
                      <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.max(0, parseFloat((draft.deliveredQuantity - 0.5).toFixed(1)));
                            setDayDrafts((prev) => ({
                              ...prev,
                              [plan.customerId]: {
                                ...draft,
                                deliveredQuantity: next,
                                status: next === 0 ? 'SKIPPED' : next < plan.scheduledQuantity ? 'PARTIAL' : 'DELIVERED',
                              },
                            }));
                          }}
                          className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-white rounded-lg cursor-pointer"
                        >
                          -0.5L
                        </button>

                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={draft.deliveredQuantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setDayDrafts((prev) => ({
                              ...prev,
                              [plan.customerId]: {
                                ...draft,
                                deliveredQuantity: val,
                                status: val === 0 ? 'SKIPPED' : val < plan.scheduledQuantity ? 'PARTIAL' : 'DELIVERED',
                              },
                            }));
                          }}
                          className="w-14 text-center font-mono font-bold text-xs bg-transparent text-slate-900 focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            const next = parseFloat((draft.deliveredQuantity + 0.5).toFixed(1));
                            setDayDrafts((prev) => ({
                              ...prev,
                              [plan.customerId]: {
                                ...draft,
                                deliveredQuantity: next,
                                status: next > plan.scheduledQuantity ? 'EXTRA' : 'DELIVERED',
                              },
                            }));
                          }}
                          className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-white rounded-lg cursor-pointer"
                        >
                          +0.5L
                        </button>
                      </div>

                      {/* Status Selector */}
                      <select
                        value={draft.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as DeliveryStatus;
                          setDayDrafts((prev) => ({
                            ...prev,
                            [plan.customerId]: {
                              ...draft,
                              status: newStatus,
                              deliveredQuantity: newStatus === 'SKIPPED' ? 0 : draft.deliveredQuantity || plan.scheduledQuantity,
                            },
                          }));
                        }}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800"
                      >
                        <option value="DELIVERED">✓ Delivered</option>
                        <option value="PARTIAL">½ Partial</option>
                        <option value="EXTRA">+ Extra</option>
                        <option value="SKIPPED">0L Skipped</option>
                      </select>

                      {/* Save to System Button */}
                      <button
                        type="button"
                        onClick={() => handleSaveCustomerDelivery(plan)}
                        disabled={isSaving}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  onSelectDate(activeDay);
                  setShowDayModal(false);
                }}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Open Full Daily Delivery Sheet →</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDayModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
