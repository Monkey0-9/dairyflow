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
import OpsConsole from '@/components/farmer/OpsConsole';
import { AdminMetricsHeader } from '@/components/admin/AdminMetricsHeader';
import { AdminExceptionsCenter } from '@/components/admin/AdminExceptionsCenter';
import { AdminActivitySidebar } from '@/components/admin/AdminActivitySidebar';
import { BottomNav } from '@/components/ui/BottomNav';
import {
  Droplets,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  Layers,
  FileText,
  UserCheck,
  Truck,
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<string>('daily');
  // Authenticated session user — resolved from HttpOnly session cookie via
  // /api/auth/me. Never hardcoded: Navbar audit trail and farmer-scoped
  // writes derive actor identity from this session object.
  const [sessionUser, setSessionUser] = useState<{ userId: string; name?: string; role?: string } | null>(null);

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

  // Resolve authenticated session once — guards the command center and
  // supplies the real actor identity to Navbar/audit components.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!cancelled && data?.authenticated && data?.user?.userId) {
          setSessionUser(data.user);
        }
      } catch {
        // Session resolution is best-effort here; API routes enforce auth strictly.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        currentUserId={sessionUser?.userId || ''}
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
        {/* Operational metrics header (extracted component) */}
        <AdminMetricsHeader
          selectedDate={selectedDate}
          stats={stats}
          monthToDate={monthToDate}
          onRefresh={loadAdminData}
          onLogout={handleLogout}
        />

        {/* Operational Exceptions Center (extracted component) */}
        <AdminExceptionsCenter
          stats={stats}
          openDisputeCount={openDisputeCount}
          pendingCustomerCount={pendingCustomerCount}
          totalPendingRequests={totalPendingRequests}
          pendingExtraCount={pendingExtraCount}
          extraRequests={extraRequests}
          onNavigateTab={setActiveTab}
          onReviewExtra={handleReviewExtraRequest}
        />

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

          {/* Right Live Activity Feed Sidebar (extracted component) */}
          <AdminActivitySidebar activities={activities} onNavigateTab={setActiveTab} />
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
