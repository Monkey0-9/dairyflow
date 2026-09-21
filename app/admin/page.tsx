'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DeliveryRecord,
  Product,
  Invoice,
  Dispute,
  Notification,
  DeliveryStatus,
  PaymentMethod,
  AdminOperationalStats,
  ActivityEvent,
  ExtraMilkRequest,
  PauseRequest,
  CustomerProfile,
} from '@/lib/types';
import Navbar from '@/components/Navbar';
import FarmerDashboard from '@/components/farmer/FarmerDashboard';
import MonthlyLedgerCalendar from '@/components/farmer/MonthlyLedgerCalendar';
import CustomerManagement from '@/components/farmer/CustomerManagement';
import BillingManager from '@/components/farmer/BillingManager';
import DisputeResolver from '@/components/farmer/DisputeResolver';
import ProductPricing from '@/components/farmer/ProductPricing';
import AIForecastingView from '@/components/farmer/AIForecastingView';
import AuditTrailViewer from '@/components/farmer/AuditTrailViewer';
import DeliveryRouteView from '@/components/farmer/DeliveryRouteView';
import InventoryManager from '@/components/farmer/InventoryManager';
import CustomerRequestsManager from '@/components/farmer/CustomerRequestsManager';
import OpsConsole from '@/components/farmer/OpsConsole';
import { BottomNav } from '@/components/ui/BottomNav';
import {
  Droplets,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  RefreshCw,
  LogOut,
  Layers,
  FileText,
  UserCheck,
  Truck,
  User,
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<string>('daily');

  // Core store data
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [extraRequests, setExtraRequests] = useState<ExtraMilkRequest[]>([]);
  const [pauseRequests, setPauseRequests] = useState<PauseRequest[]>([]);
  const [operationalStats, setOperationalStats] = useState<AdminOperationalStats | null>(null);
  const [monthToDate, setMonthToDate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Shared mutation helper: parses the API result and THROWS with the server
  // message when a save fails, so child modals stay open and the error banner
  // explains what happened instead of a silent false success.
  const apiMutate = async (path: string, options?: RequestInit) => {
    let res: Response;
    try {
      res = await fetch(path, options);
    } catch {
      throw new Error('Network failure. Check your connection and retry.');
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Server error (${res.status}). Please retry.`);
    }
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `Request failed (${res.status}).`);
    }
    return data;
  };

  const runSave = async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      const out = await fn();
      setSaveError(null);
      await loadAdminData();
      return out;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed. Please retry.';
      setSaveError(message);
      throw err;
    }
  };

  // Load all admin data
  const loadAdminData = useCallback(async () => {
    try {
      // 1. Operational Analytics (Dynamic calculation)
      const analyticsRes = await fetch(`/api/analytics/consumption?date=${selectedDate}`);
      const analyticsData = await analyticsRes.json();
      if (analyticsData.success) {
        setOperationalStats(analyticsData.stats);
        setMonthToDate(analyticsData.monthToDate);
      }

      // 2. Ledger for selected date
      const ledgerRes = await fetch(`/api/ledger?date=${selectedDate}`);
      const ledgerData = await ledgerRes.json();
      if (ledgerData.success) {
        setRecords(ledgerData.records);
      }

      // 3. Customers & Products
      const custRes = await fetch('/api/customers');
      const custData = await custRes.json();
      if (custData.success) {
        setCustomers(custData.customers);
        setProducts(custData.products);
      }

      // 4. Invoices
      const now = new Date();
      const invRes = await fetch(`/api/invoices?month=${now.getMonth() + 1}&year=${now.getFullYear()}`);
      const invData = await invRes.json();
      if (invData.success) {
        setInvoices(invData.invoices);
      }

      // 5. Disputes
      const dispRes = await fetch('/api/disputes');
      const dispData = await dispRes.json();
      if (dispData.success) {
        setDisputes(dispData.disputes);
      }

      // 6. Requests (Pauses & Extra Milk)
      const reqRes = await fetch('/api/farmer/requests');
      const reqData = await reqRes.json();
      if (reqData.success) {
        setPauseRequests(reqData.pauseRequests || []);
        setExtraRequests(reqData.milkRequests || []);
      }

      // 7. Activity stream
      const actRes = await fetch('/api/activity');
      const actData = await actRes.json();
      if (actData.success) {
        setActivities(actData.activities);
      }

      // 8. Notifications
      const notifRes = await fetch('/api/notifications');
      const notifData = await notifRes.json();
      if (notifData.success) {
        setNotifications(notifData.notifications);
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Update a delivery record
  const handleUpdateRecord = async (
    recordId: string,
    updates: {
      deliveredQuantity?: number;
      status?: DeliveryStatus;
      reason?: string;
      notes?: string;
      bottlesReturned?: number;
    }
  ) => {
    return runSave(async () => {
      try {
        return await apiMutate('/api/ledger', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId,
            ...updates,
          }),
        });
      } catch (err: unknown) {
        // FR-DEL-009: When day closing is finalized (HTTP 423), route to explicit delivery-corrections workflow
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('FINALIZED') || (typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 423)) {
          const reasonText = updates.reason || updates.notes || 'Administrative ledger correction post day closing';
          return await apiMutate('/api/delivery-corrections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deliveryRecordId: recordId,
              correctedQuantity: updates.deliveredQuantity,
              correctedStatus: updates.status,
              reason: reasonText.length >= 5 ? reasonText : 'Administrative ledger correction post day closing',
            }),
          });
        }
        throw err;
      }
    });
  };

  // Add customer
  const handleAddCustomer = async (formData: any) => {
    return runSave(() =>
      apiMutate('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
    );
  };

  // Delete customer
  const handleDeleteCustomer = async (customerId: string) => {
    return runSave(() =>
      apiMutate(`/api/customers?id=${customerId}`, {
        method: 'DELETE',
      })
    );
  };


  // Review extra milk request
  const handleReviewExtraRequest = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    return runSave(() =>
      apiMutate(`/api/farmer/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'MILK', action }),
      })
    );
  };

  // Review pause request
  const handleReviewPauseRequest = async (
    requestId: string,
    action: 'APPROVED' | 'REJECTED',
    reason?: string
  ) => {
    return runSave(() =>
      apiMutate(`/api/farmer/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PAUSE',
          action,
          rejectionReason: reason,
        }),
      })
    );
  };

  // Review milk request with note
  const handleReviewMilkRequest = async (
    requestId: string,
    action: 'APPROVED' | 'REJECTED',
    reason?: string
  ) => {
    return runSave(() =>
      apiMutate(`/api/farmer/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'MILK',
          action,
          note: reason,
        }),
      })
    );
  };

  // Resolve dispute
  const handleResolveDispute = async (
    disputeId: string,
    action: 'ACCEPT' | 'REJECT' | 'CUSTOM',
    customQty?: number,
    note?: string
  ) => {
    return runSave(() =>
      apiMutate('/api/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId,
          action,
          customQuantity: customQty,
          farmerNote: note,
        }),
      })
    );
  };

  // Record Offline Payment
  const handleRecordPayment = async (
    invoiceId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    note?: string
  ) => {
    return runSave(() =>
      apiMutate('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          amount,
          paymentMethod,
          note,
        }),
      })
    );
  };

  // Recalculate invoices
  const handleRecalculateInvoices = async () => {
    const target = new Date(selectedDate || Date.now());
    const targetMonth = target.getMonth() + 1;
    const targetYear = target.getFullYear();
    return runSave(() =>
      apiMutate('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: targetMonth, year: targetYear }),
      })
    );
  };

  // Mark notification read
  const handleMarkNotificationRead = async (id: string) => {
    // Optimistic update: instantly clears unread highlight and badge count in UI
    setNotifications((prev) =>
      prev.map((n) => (id === 'ALL' || n.id === id ? { ...n, read: true } : n))
    );

    try {
      // Send notificationId only; backend should infer userId from session cookies
      await apiMutate('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setSaveError(null);
    } catch (err) {
      console.warn('Failed to persist notification read state to server:', err);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const openDisputeCount = disputes.filter((d) => d.status === 'OPEN').length;
  const pendingExtraCount = extraRequests.filter((r) => r.status === 'PENDING').length;
  const pendingPauseCount = pauseRequests.filter((p) => p.status === 'PENDING').length;
  const totalPendingRequests = pendingExtraCount + pendingPauseCount;
  const pendingCustomerCount = customers.filter((c) => c.accountStatus === 'PENDING').length;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/20 mb-3">
          <Droplets className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-slate-900">MilkFlow Private Reserve Admin Command Center</h2>
        <p className="text-xs text-slate-500 mt-1">Calculating real delivery ledger & revenue analytics...</p>
      </div>
    );
  }

  // SRS AI-ANA-003: never present fabricated metrics in production.
  // When operational stats are unavailable, derive empty-state zeros from
  // real customer counts instead of hardcoded demo litres/revenue.
  const activeCustomers = customers.filter((c) => c.active).length;
  const stats = operationalStats || {
    date: selectedDate,
    totalCustomers: activeCustomers,
    expectedLitres: 0,
    deliveredLitres: 0,
    partialLitres: 0,
    skippedLitres: 0,
    extraLitres: 0,
    billableLitres: 0,
    todayRevenue: 0,
    todayCollected: 0,
    todayOutstanding: 0,
    productBreakdown: { cow: 0, buffalo: 0, a2: 0 },
    exceptionCounts: {
      partial: 0,
      skipped: 0,
      disputes: openDisputeCount,
      extraRequests: pendingExtraCount,
      pendingCustomers: pendingCustomerCount,
      overdueInvoices: 0,
    },
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col">
      {/* Save-error banner: every failed mutation surfaces here with the
          server message instead of failing silently. */}
      {saveError && (
        <div className="mx-4 mt-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Save failed — your change was NOT saved.</p>
            <p className="mt-0.5">{saveError}</p>
          </div>
          <button
            onClick={() => setSaveError(null)}
            className="rounded-lg px-2 py-1 text-xs font-bold hover:bg-red-100"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Top Navbar */}
      <Navbar
        currentRole="FARMER"
        // currentUserId should be fetched from session; for now using empty string
        // as the actual user ID is not available in this component
        currentUserId=""
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        disputeCount={openDisputeCount}
        pendingRequestsCount={totalPendingRequests}
      />

      {/* Main Workspace */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Dynamic Admin Operational Header - Clean White Enterprise Design */}
        <div className="bg-white text-slate-900 p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-700 font-bold">
                  Operational Control Room • Real-Time Database State
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span>MilkFlow Dairy Operations</span>
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                  {selectedDate === new Date().toISOString().split('T')[0] ? `Today (${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})` : selectedDate}
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/profile"
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition border border-slate-200 cursor-pointer"
                title="Admin & Farmer Profile"
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile</span>
              </Link>
              <button
                onClick={loadAdminData}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition border border-slate-200 cursor-pointer"
                title="Refresh from Database"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync DB</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition border border-rose-200 cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Real Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500">Total Customers</span>
              <div className="text-xl font-black font-mono mt-1 text-slate-900">{stats.totalCustomers}</div>
              <span className="text-[10px] text-emerald-600 mt-0.5 block font-semibold">Active Daily Subscribers</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500">Expected Milk</span>
              <div className="text-xl font-black font-mono mt-1 text-slate-900">
                {stats.expectedLitres} <span className="text-xs font-normal text-slate-500">L</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Scheduled Demand</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800">Delivered Milk</span>
              <div className="text-xl font-black font-mono mt-1 text-emerald-700">
                {stats.deliveredLitres} <span className="text-xs font-normal text-emerald-600">L</span>
              </div>
              <span className="text-[10px] text-emerald-700 mt-0.5 block">Actual Dropped</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500">Billable Milk</span>
              <div className="text-xl font-black font-mono mt-1 text-slate-900">
                {stats.billableLitres} <span className="text-xs font-normal text-slate-500">L</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Server Calculated</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500">Today Revenue</span>
              <div className="text-xl font-black font-mono mt-1 text-slate-900">
                ₹{stats.todayRevenue}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Delivered Worth</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500">Today Collected</span>
              <div className="text-xl font-black font-mono mt-1 text-emerald-700">
                ₹{stats.todayCollected}
              </div>
              <span className="text-[10px] text-emerald-600 mt-0.5 block font-semibold">Payments Logged</span>
            </div>
          </div>

          {/* Product Breakdown Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3 font-semibold text-slate-700">
              <span className="text-slate-500">Product Consumption:</span>
              <span className="text-emerald-700">Cow: <strong>{stats.productBreakdown.cow} L</strong></span>
              <span>•</span>
              <span className="text-blue-700">Buffalo: <strong>{stats.productBreakdown.buffalo} L</strong></span>
              <span>•</span>
              <span className="text-purple-700">Desi A2: <strong>{stats.productBreakdown.a2} L</strong></span>
            </div>

            {monthToDate && (
              <div className="text-slate-500 text-[11px] font-mono">
                Sep MTD Total: <strong className="text-slate-900">{monthToDate.deliveredLitres} L</strong> | Revenue:{' '}
                <strong className="text-emerald-700 font-bold">₹{monthToDate.revenue}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Operational Exceptions Center */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Operational Exceptions Center
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">1-Click Actions Required</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
            <button
              onClick={() => setActiveTab('disputes')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                openDisputeCount > 0
                  ? 'bg-rose-50/80 border-rose-300 text-rose-950 hover:bg-rose-100'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="font-extrabold text-lg font-mono">{openDisputeCount}</div>
              <div className="font-bold text-[11px]">Open Disputes</div>
              <span className="text-[10px] opacity-80">{openDisputeCount > 0 ? 'Resolve Now →' : 'Zero Disputes'}</span>
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                pendingCustomerCount > 0
                  ? 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="font-extrabold text-lg font-mono">{pendingCustomerCount}</div>
              <div className="font-bold text-[11px]">Pending Signups</div>
              <span className="text-[10px] opacity-80">
                {pendingCustomerCount > 0 ? 'Review & Approve →' : 'All Approved'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('daily')}
              className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 text-left transition cursor-pointer"
            >
              <div className="font-extrabold text-lg font-mono">{stats.exceptionCounts.skipped}</div>
              <div className="font-bold text-[11px]">Skipped Today</div>
              <span className="text-[10px] text-slate-500">0 L Billable</span>
            </button>

            <button
              onClick={() => setActiveTab('daily')}
              className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 text-left transition cursor-pointer"
            >
              <div className="font-extrabold text-lg font-mono">{stats.exceptionCounts.partial}</div>
              <div className="font-bold text-[11px]">Partial Today</div>
              <span className="text-[10px] text-slate-500">Delivered &lt; Expected</span>
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                totalPendingRequests > 0
                  ? 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="font-extrabold text-lg font-mono">{totalPendingRequests}</div>
              <div className="font-bold text-[11px]">Customer Requests</div>
              <span className="text-[10px] opacity-80">
                {totalPendingRequests > 0 ? 'Review & Approve →' : 'Zero Pending'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('billing')}
              className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 text-left transition cursor-pointer"
            >
              <div className="font-extrabold text-lg font-mono">{stats.exceptionCounts.overdueInvoices}</div>
              <div className="font-bold text-[11px]">Payment Due</div>
              <span className="text-[10px] text-slate-500">Send WhatsApp Bill →</span>
            </button>
          </div>

          {/* Pending Extra Milk Requests Quick Approval Strip */}
          {pendingExtraCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <strong>Extra Milk Request:</strong>{' '}
                  <span>
                    {extraRequests[0].customerName} requested {extraRequests[0].requestedQuantity} L for{' '}
                    {extraRequests[0].date} (&ldquo;{extraRequests[0].reason}&rdquo;)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleReviewExtraRequest(extraRequests[0].id, 'APPROVED')}
                  className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve (+1.0 L)</span>
                </button>
                <button
                  onClick={() => handleReviewExtraRequest(extraRequests[0].id, 'REJECTED')}
                  className="px-3 py-1 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content Layout with Left Component and Right Live Activity Feed */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          {/* Main Active Tab Workspace (3 Columns on desktop) */}
          <div className="xl:col-span-3 space-y-6">
            {activeTab === 'daily' && (
              <FarmerDashboard
                selectedDate={selectedDate}
                records={records}
                customers={customers}
                stats={{
                  customerCount: stats.totalCustomers,
                  totalScheduled: stats.expectedLitres,
                  totalDelivered: stats.deliveredLitres,
                  pendingLitres: Math.max(0, stats.expectedLitres - stats.deliveredLitres),
                  deliveredCount: records.filter((r) => r.status === 'DELIVERED').length,
                  skippedCount: stats.exceptionCounts.skipped,
                  partialCount: stats.exceptionCounts.partial,
                  disputedCount: openDisputeCount,
                }}
                onUpdateRecord={handleUpdateRecord}
                onRefresh={loadAdminData}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'calendar' && (
              <MonthlyLedgerCalendar
                customers={customers}
                products={products}
                pauseRequests={pauseRequests}
                extraRequests={extraRequests}
                onSelectDate={(d) => {
                  setSelectedDate(d);
                  setActiveTab('daily');
                }}
                onUpdateRecord={handleUpdateRecord}
                onRefresh={loadAdminData}
              />
            )}

            {activeTab === 'customers' && (
              <CustomerManagement
                customers={customers}
                products={products}
                invoices={invoices}
                onAddCustomer={handleAddCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onRefresh={loadAdminData}
              />
            )}

            {activeTab === 'billing' && (
              <BillingManager
                invoices={invoices}
                onRefresh={loadAdminData}
                onRecalculateAll={handleRecalculateInvoices}
                onRecordPayment={handleRecordPayment}
              />
            )}

            {activeTab === 'disputes' && (
              <DisputeResolver
                disputes={disputes}
                onResolveDispute={handleResolveDispute}
                onRefresh={loadAdminData}
              />
            )}

            {activeTab === 'requests' && (
              <CustomerRequestsManager
                pauseRequests={pauseRequests}
                milkRequests={extraRequests}
                customers={customers}
                onReviewPause={handleReviewPauseRequest}
                onReviewMilk={handleReviewMilkRequest}
                onRefresh={loadAdminData}
              />
            )}

            {activeTab === 'pricing' && <ProductPricing products={products} />}

            {activeTab === 'ops' && (
              <OpsConsole
                customers={customers}
                products={products}
                invoices={invoices}
                onRefresh={loadAdminData}
              />
            )}

            {activeTab === 'forecast' && <AIForecastingView />}

            {activeTab === 'audit' && <AuditTrailViewer />}

            {activeTab === 'inventory' && (
              <InventoryManager
                selectedDate={selectedDate}
                totalDelivered={stats.deliveredLitres}
                totalExpected={stats.expectedLitres}
                skippedCount={stats.exceptionCounts.skipped}
                onRefresh={loadAdminData}
              />
            )}

            {activeTab === 'routes' && (
              <DeliveryRouteView
                customers={customers}
                records={records}
                onRefresh={loadAdminData}
                onQuickDeliver={(r) =>
                  handleUpdateRecord(r.id, {
                    deliveredQuantity: r.scheduledQuantity,
                    status: 'DELIVERED',
                  })
                }
                onQuickSkip={(r) =>
                  handleUpdateRecord(r.id, {
                    deliveredQuantity: 0,
                    status: 'SKIPPED',
                    reason: 'Customer requested skip',
                  })
                }
              />
            )}

            {activeTab === 'more' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Secondary Dairy Tools</h3>
                  <p className="text-xs text-slate-500 mt-1">Select a management tool:</p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                    <button
                      onClick={() => setActiveTab('pricing')}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-left transition cursor-pointer hover:border-emerald-300 shadow-2xs"
                    >
                      <Droplets className="w-5 h-5 text-emerald-600 mb-2" />
                      <div className="font-extrabold text-xs text-slate-900">Product Pricing</div>
                      <span className="text-[11px] text-slate-500">Milk rates &amp; catalog</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('routes')}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-left transition cursor-pointer hover:border-emerald-300 shadow-2xs"
                    >
                      <Truck className="w-5 h-5 text-emerald-600 mb-2" />
                      <div className="font-extrabold text-xs text-slate-900">Delivery Routes</div>
                      <span className="text-[11px] text-slate-500">Stop sequencing</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('calendar')}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-left transition cursor-pointer hover:border-emerald-300 shadow-2xs"
                    >
                      <Calendar className="w-5 h-5 text-emerald-600 mb-2" />
                      <div className="font-extrabold text-xs text-slate-900">Monthly Calendar</div>
                      <span className="text-[11px] text-slate-500">Past ledger days</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('inventory')}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-left transition cursor-pointer hover:border-emerald-300 shadow-2xs"
                    >
                      <Layers className="w-5 h-5 text-emerald-600 mb-2" />
                      <div className="font-extrabold text-xs text-slate-900">Inventory Balance</div>
                      <span className="text-[11px] text-slate-500">Milk yield vs volume</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('disputes')}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-left transition cursor-pointer hover:border-emerald-300 shadow-2xs"
                    >
                      <AlertTriangle className="w-5 h-5 text-amber-500 mb-2" />
                      <div className="font-extrabold text-xs text-slate-900">Customer Disputes</div>
                      <span className="text-[11px] text-slate-500">{disputes.length} active</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('forecast')}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-left transition cursor-pointer hover:border-emerald-300 shadow-2xs"
                    >
                      <Sparkles className="w-5 h-5 text-purple-600 mb-2" />
                      <div className="font-extrabold text-xs text-slate-900">Demand Forecast</div>
                      <span className="text-[11px] text-slate-500">AI order projections</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('audit')}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white text-left transition cursor-pointer hover:border-emerald-300 shadow-2xs"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-2" />
                      <div className="font-extrabold text-xs text-slate-900">Audit Trail</div>
                      <span className="text-[11px] text-slate-500">Cryptographic log</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('ops')}
                      className="p-4 rounded-2xl border border-slate-900 bg-slate-900 hover:bg-slate-800 text-left transition cursor-pointer shadow-2xs"
                    >
                      <Layers className="w-5 h-5 text-amber-400 mb-2" />
                      <div className="font-extrabold text-xs text-white">Operations Console</div>
                      <span className="text-[11px] text-slate-400">Import • Merge • Transfers • Adjustments • Routes • Closings</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Live Activity Feed Sidebar (1 Column) */}
          <div className="space-y-4">
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Live Activity Stream
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200/60">
                  Real-Time
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-150 overflow-y-auto space-y-1">
                {activities.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No recent activities</p>
                ) : (
                  activities.map((act) => (
                    <div key={act.id} className="pt-2.5 pb-2 text-xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-slate-900 text-[11px]">{act.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">{act.description}</p>
                      <div className="text-[10px] text-slate-400 mt-0.5">By {act.actorName}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Farmer Shortcuts - Clean White Enterprise Design */}
            <div className="bg-white text-slate-900 p-4.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700">
                    Farmer Quick Actions
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Shortcuts
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => setActiveTab('daily')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      <Truck className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-xs truncate">Daily Delivery Run</div>
                      <div className="text-[10px] text-slate-500 truncate">Delivery checklist &amp; mark drops</div>
                    </div>
                  </div>
                  <kbd className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-2">
                    ⌥1
                  </kbd>
                </button>

                <button
                  onClick={() => setActiveTab('calendar')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-xs truncate">Delivery Calendar</div>
                      <div className="text-[10px] text-slate-500 truncate">Who receives what quantity</div>
                    </div>
                  </div>
                  <kbd className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-2">
                    ⌥2
                  </kbd>
                </button>

                <button
                  onClick={() => setActiveTab('billing')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-xs truncate">Monthly Invoices</div>
                      <div className="text-[10px] text-slate-500 truncate">Automated billing ledger</div>
                    </div>
                  </div>
                  <kbd className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-2">
                    ⌥3
                  </kbd>
                </button>

                <button
                  onClick={() => setActiveTab('audit')}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-xs truncate">Cryptographic Audit</div>
                      <div className="text-[10px] text-slate-500 truncate">SHA-256 tamper-proof log</div>
                    </div>
                  </div>
                  <kbd className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-2">
                    ⌥4
                  </kbd>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">MilkFlow Dairy Operations Portal</span>
            <span>•</span>
            <span>PostgreSQL Authoritative DB</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Server-side Authenticated Session Active</span>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation for 1-Thumb Field Use */}
      <BottomNav
        activeId={['daily', 'calendar', 'customers', 'billing', 'requests'].includes(activeTab) ? activeTab : 'more'}
        onChange={(id) => setActiveTab(id)}
        items={[
          { id: 'daily', label: 'Daily Run', icon: <Truck className="w-5 h-5" /> },
          { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-5 h-5" /> },
          { id: 'customers', label: 'Clients', icon: <UserCheck className="w-5 h-5" /> },
          { id: 'billing', label: 'Bills', icon: <FileText className="w-5 h-5" /> },
          { id: 'requests', label: 'Requests', icon: <Clock className="w-5 h-5" />, badge: totalPendingRequests },
          { id: 'more', label: 'More', icon: <Layers className="w-5 h-5" /> },
        ]}
      />
    </div>
  );
}
