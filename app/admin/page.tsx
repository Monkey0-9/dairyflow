'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Droplets,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  TrendingUp,
  RefreshCw,
  LogOut,
  Layers,
  FileText,
  UserCheck,
  Truck,
  PlusCircle,
  XCircle,
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
    try {
      const res = await fetch('/api/ledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          ...updates,
          changedBy: 'Suresh Patel (Farmer)',
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add customer
  const handleAddCustomer = async (formData: any) => {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    }
    return data;
  };

  // Delete customer
  const handleDeleteCustomer = async (customerId: string) => {
    const res = await fetch(`/api/customers?id=${customerId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    }
    return data;
  };

  // Approve pending customer
  const handleApproveCustomer = async (customerId: string) => {
    const res = await fetch('/api/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, action: 'APPROVE' }),
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    }
  };

  // Review extra milk request
  const handleReviewExtraRequest = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    const res = await fetch(`/api/farmer/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'MILK', action, reviewedBy: 'Suresh Patel (Farmer)' }),
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    }
  };

  // Review pause request
  const handleReviewPauseRequest = async (
    requestId: string,
    action: 'APPROVED' | 'REJECTED',
    reason?: string
  ) => {
    const res = await fetch(`/api/farmer/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'PAUSE',
        action,
        rejectionReason: reason,
        reviewedBy: 'Suresh Patel (Farmer)',
      }),
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    }
  };

  // Review milk request with note
  const handleReviewMilkRequest = async (
    requestId: string,
    action: 'APPROVED' | 'REJECTED',
    reason?: string
  ) => {
    const res = await fetch(`/api/farmer/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'MILK',
        action,
        note: reason,
        reviewedBy: 'Suresh Patel (Farmer)',
      }),
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    }
  };

  // Resolve dispute
  const handleResolveDispute = async (
    disputeId: string,
    action: 'ACCEPT' | 'REJECT' | 'CUSTOM',
    customQty?: number,
    note?: string
  ) => {
    const res = await fetch('/api/disputes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disputeId,
        action,
        customQuantity: customQty,
        farmerNote: note,
      }),
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    }
  };

  // Record Offline Payment
  const handleRecordPayment = async (
    invoiceId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    note?: string
  ) => {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId,
        amount,
        paymentMethod,
        note,
      }),
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    }
  };

  // Recalculate invoices
  const handleRecalculateInvoices = async () => {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 9, year: 2026 }),
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    }
  };

  // Mark notification read
  const handleMarkNotificationRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    });
    loadAdminData();
  };

  // Persona switcher handler
  const handlePersonaChange = async (_role: string, userId: string) => {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoUserId: userId }),
    });
    if (userId === 'user_admin') router.push('/superadmin');
    else if (userId.startsWith('user_')) router.push('/customer');
    else router.push('/admin');
    router.refresh();
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
        <h2 className="text-lg font-black text-slate-900">GreenValley Dairy Admin Command Center</h2>
        <p className="text-xs text-slate-500 mt-1">Calculating real delivery ledger & revenue analytics...</p>
      </div>
    );
  }

  const stats = operationalStats || {
    date: selectedDate,
    totalCustomers: customers.filter((c) => c.active).length,
    expectedLitres: 7.0,
    deliveredLitres: 4.5,
    partialLitres: 0.5,
    skippedLitres: 1.0,
    extraLitres: 0.0,
    billableLitres: 4.5,
    todayRevenue: 225.0,
    todayCollected: 725.0,
    todayOutstanding: 0.0,
    productBreakdown: { cow: 1.5, buffalo: 1.0, a2: 2.0 },
    exceptionCounts: {
      partial: 1,
      skipped: 1,
      disputes: openDisputeCount,
      extraRequests: pendingExtraCount,
      pendingCustomers: pendingCustomerCount,
      overdueInvoices: 1,
    },
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        currentRole="FARMER"
        currentUserId="user_farmer"
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onPersonaChange={handlePersonaChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        disputeCount={openDisputeCount}
        pendingRequestsCount={totalPendingRequests}
      />

      {/* Main Workspace */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Dynamic Admin Operational Header */}
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 rounded-3xl shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                  Operational Control Room • Real-Time Database State
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <span>GreenValley Dairy Farm</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-bold">
                  {selectedDate === new Date().toISOString().split('T')[0] ? `Today (${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})` : selectedDate}
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadAdminData}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Refresh from Database"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync DB</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition border border-rose-500/30 cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Real Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Customers</span>
              <div className="text-xl font-black font-mono mt-1 text-white">{stats.totalCustomers}</div>
              <span className="text-[10px] text-emerald-400 mt-0.5 block font-semibold">Active Daily Subscribers</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400">Expected Milk</span>
              <div className="text-xl font-black font-mono mt-1 text-slate-200">
                {stats.expectedLitres} <span className="text-xs font-normal text-slate-400">L</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Scheduled Demand</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[10px] uppercase font-bold text-emerald-300">Delivered Milk</span>
              <div className="text-xl font-black font-mono mt-1 text-emerald-300">
                {stats.deliveredLitres} <span className="text-xs font-normal text-emerald-400">L</span>
              </div>
              <span className="text-[10px] text-emerald-400 mt-0.5 block">Actual Dropped</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400">Billable Milk</span>
              <div className="text-xl font-black font-mono mt-1 text-emerald-400">
                {stats.billableLitres} <span className="text-xs font-normal text-slate-400">L</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Server Calculated</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400">Today Revenue</span>
              <div className="text-xl font-black font-mono mt-1 text-white">
                ₹{stats.todayRevenue}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Delivered Worth</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400">Today Collected</span>
              <div className="text-xl font-black font-mono mt-1 text-emerald-400">
                ₹{stats.todayCollected}
              </div>
              <span className="text-[10px] text-emerald-400 mt-0.5 block">Payments Logged</span>
            </div>
          </div>

          {/* Product Breakdown Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-black/20 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-3 font-semibold">
              <span className="text-slate-400">Product Consumption:</span>
              <span className="text-emerald-300">Cow: <strong>{stats.productBreakdown.cow} L</strong></span>
              <span>•</span>
              <span className="text-blue-300">Buffalo: <strong>{stats.productBreakdown.buffalo} L</strong></span>
              <span>•</span>
              <span className="text-purple-300">Desi A2: <strong>{stats.productBreakdown.a2} L</strong></span>
            </div>

            {monthToDate && (
              <div className="text-slate-400 text-[11px] font-mono">
                Sep MTD Total: <strong className="text-white">{monthToDate.deliveredLitres} L</strong> | Revenue:{' '}
                <strong className="text-emerald-400">₹{monthToDate.revenue}</strong>
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Main Active Tab Workspace (3 Columns) */}
          <div className="lg:col-span-3 space-y-6">
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
                onSelectDate={(d) => {
                  setSelectedDate(d);
                  setActiveTab('daily');
                }}
                onUpdateRecord={handleUpdateRecord}
              />
            )}

            {activeTab === 'customers' && (
              <CustomerManagement
                customers={customers}
                products={products}
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
          </div>

          {/* Right Live Activity Feed Sidebar (1 Column) */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Live Activity Stream
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
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

            {/* Quick Actions Card */}
            <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xs space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                Quick Farmer Shortcuts
              </h4>
              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => setActiveTab('daily')}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 transition flex items-center justify-between cursor-pointer"
                >
                  <span>Start Morning Delivery Run</span>
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                </button>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 transition flex items-center justify-between cursor-pointer"
                >
                  <span>Close Day & Reconcile Milk</span>
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                </button>
                <button
                  onClick={() => setActiveTab('billing')}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 transition flex items-center justify-between cursor-pointer"
                >
                  <span>Generate September Invoices</span>
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 transition flex items-center justify-between cursor-pointer"
                >
                  <span>Verify Cryptographic Audit</span>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
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
            <span className="font-bold text-slate-700">GreenValley Dairy Farm Portal</span>
            <span>•</span>
            <span>Plot 42, Anand-Nadiad Highway</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Server-side Authenticated Session:</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Suresh Patel (Farmer Admin)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
