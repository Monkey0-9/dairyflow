'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CustomerProfile,
  Subscription,
  Invoice,
  Payment,
  DeliveryRecord,
  PauseRequest,
  ExtraMilkRequest,
} from '@/lib/types';
import { MemberHome } from './MemberHome';
import { MemberStatements } from './MemberStatements';
import { MemberConcierge } from './MemberConcierge';
import { ClientUpiPayment } from './ClientUpiPayment';
import { MemberProfile } from './MemberProfile';
import { MemberCalendar } from './MemberCalendar';
import { MemberQR } from './MemberQR';
import InvoiceModal from '../common/InvoiceModal';
import ReceiptModal from '../common/ReceiptModal';
import PhonePeUpiModal from './PhonePeUpiModal';
import { Button } from '@/components/ui/Button';
import { useMilkFlowEvents, playNotificationChime } from '@/lib/use-milkflow-events';
import type { MilkFlowEvent } from '@/lib/events';
import { Droplets, ShieldCheck, Sparkles, QrCode, FileText, User, CalendarDays } from 'lucide-react';

interface CustomerPortalProps {
  currentUserId: string;
  customers: CustomerProfile[];
  onRefreshAll: () => void;
  initialTab?: 'HOME' | 'STATEMENTS' | 'CALENDAR' | 'CONCIERGE' | 'PAYMENT' | 'QR' | 'PROFILE';
}

export default function CustomerPortal({
  currentUserId,
  customers,
  onRefreshAll,
  initialTab = 'HOME',
}: CustomerPortalProps) {
  const [customerData, setCustomerData] = useState<any>(null);
  const [pauseRequests, setPauseRequests] = useState<PauseRequest[]>([]);
  const [milkRequests, setMilkRequests] = useState<ExtraMilkRequest[]>([]);
  const [todayRecord, setTodayRecord] = useState<DeliveryRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'HOME' | 'STATEMENTS' | 'CALENDAR' | 'CONCIERGE' | 'PAYMENT' | 'QR' | 'PROFILE'>(
    initialTab
  );
  const [conciergeInitialSheet, setConciergeInitialSheet] = useState<'pause' | 'extra' | 'qty' | null>(null);
  const [loading, setLoading] = useState(true);
  // User-facing fetch failure (previously console-only). Rendered as a
  // retryable banner so clients know when allocation data is stale.
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modals
  const [showInvoiceModal, setShowInvoiceModal] = useState<Invoice | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<Payment | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');

  const currentCustomer: CustomerProfile | undefined =
    customers.find((c) => c.userId === currentUserId || c.id === currentUserId) || customers[0];

  const fetchCustomerDetails = useCallback(async () => {
    if (!currentCustomer) {
      setLoading(false);
      return;
    }
    try {
      setFetchError(null);
      const res = await fetch(`/api/customer/dashboard?customerId=${currentCustomer.id}`);
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
      const raw = await res.json();
      if (raw.success) {
        const payload = raw.data || raw;
        setCustomerData(payload);
        setPauseRequests(payload.pauseRequests || raw.pauseRequests || []);
        setMilkRequests(payload.extraMilkRequests || raw.extraMilkRequests || []);
        setTodayRecord(payload.todayRecord || raw.todayRecord || null);
      } else {
        throw new Error(raw.error || 'Failed to load allocation details.');
      }
    } catch (err) {
      console.error('Failed to fetch client details', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load allocation details.');
    } finally {
      setLoading(false);
    }
  }, [currentCustomer]);

  useEffect(() => {
    fetchCustomerDetails();
  }, [fetchCustomerDetails]);

  // Live SSE listener for client delivery confirmations
  const handleLiveEvent = useCallback(
    (ev: MilkFlowEvent) => {
      if (
        ev.type === 'delivery:updated' ||
        ev.type === 'request:approved' ||
        ev.type === 'request:rejected' ||
        ev.type === 'payment:received' ||
        ev.type === 'payment:submitted' ||
        ev.type === 'payment:rejected' ||
        ev.type === 'invoice:created'
      ) {
        playNotificationChime();
        fetchCustomerDetails();
      }
    },
    [fetchCustomerDetails]
  );

  useMilkFlowEvents(handleLiveEvent);

  const latestInvoice: Invoice | null =
    customerData?.invoices?.find(
      (i: Invoice) => i.month === new Date().getMonth() + 1 && i.year === new Date().getFullYear()
    ) || customerData?.invoices?.[0] || null;

  const handleInitiatePay = (invoice?: Invoice) => {
    const target = invoice || latestInvoice;
    if (!target) return;
    setSelectedInvoiceToPay(target);
    const bal = Math.max(0, target.totalAmount - target.paidAmount);
    setPayAmount(String(bal || target.totalAmount));
    setShowPayModal(true);
  };

  const handleDownloadPdf = (invoice: Invoice) => {
    window.open(`/api/invoices/statement?invoiceId=${invoice.id}`, '_blank');
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-10 h-10 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30 animate-spin">
          <Droplets className="w-5 h-5" />
        </div>
        <p className="text-xs font-mono text-slate-500">Connecting to Private Reserve Vault...</p>
      </div>
    );
  }

  if (!currentCustomer) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <div className="w-14 h-14 rounded-3xl bg-slate-900 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Private Reserve Client Allocation in Progress
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Your estate client profile is being provisioned by the farm administrator. Your deliveries and single-estate records will appear here as soon as allocation completes.
        </p>
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Refresh Allocation
          </Button>
        </div>
      </div>
    );
  }

  const activeSubscription: Subscription | null =
    customerData?.subscriptions?.[0] || customerData?.subscription || null;

  return (
    <div className="space-y-6">
      {fetchError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 px-4 py-3 text-xs text-rose-800 dark:text-rose-200 flex items-start justify-between gap-3" role="alert">
          <div>
            <span className="font-bold">Couldn&apos;t refresh your allocation: </span>
            <span>{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void fetchCustomerDetails();
            }}
            className="shrink-0 rounded-lg px-2.5 py-1 font-bold bg-rose-100 dark:bg-rose-900 hover:bg-rose-200 dark:hover:bg-rose-800 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
      {/* Secondary Client Nav Pills */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('HOME')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'HOME'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Allocation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STATEMENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'STATEMENTS'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Statements</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CALENDAR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CALENDAR'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
            <span>Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConciergeInitialSheet(null);
              setActiveTab('CONCIERGE');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CONCIERGE'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Concierge</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PAYMENT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'PAYMENT'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pay via UPI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('QR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'QR'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>QR Token</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'PROFILE'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'HOME' && (
        <MemberHome
          customer={currentCustomer}
          todayRecord={todayRecord}
          subscription={activeSubscription}
          latestInvoice={latestInvoice}
          onPayNow={() => setActiveTab('PAYMENT')}
          onOpenStatements={() => setActiveTab('STATEMENTS')}
          onOpenConcierge={(type) => {
            setConciergeInitialSheet(type);
            setActiveTab('CONCIERGE');
          }}
          onOpenQR={() => setActiveTab('QR')}
        />
      )}

      {activeTab === 'STATEMENTS' && (
        <MemberStatements
          invoices={customerData?.invoices || []}
          payments={customerData?.payments || []}
          onViewInvoice={(inv) => setShowInvoiceModal(inv)}
          onPayInvoice={(inv) => handleInitiatePay(inv)}
          onDownloadPdf={handleDownloadPdf}
        />
      )}

      {activeTab === 'CALENDAR' && currentCustomer && (
        <MemberCalendar customerId={currentCustomer.id} />
      )}

      {activeTab === 'CONCIERGE' && (
        <MemberConcierge
          customerId={currentCustomer.id}
          farmerId={currentCustomer.farmerId}
          pauseRequests={pauseRequests}
          milkRequests={milkRequests}
          defaultSheet={conciergeInitialSheet}
          onCloseSheet={() => setConciergeInitialSheet(null)}
          onRefresh={fetchCustomerDetails}
        />
      )}

      {activeTab === 'PAYMENT' && (
        <ClientUpiPayment
          customer={currentCustomer}
          invoices={customerData?.invoices || []}
          payments={customerData?.payments || []}
          onRefresh={() => {
            fetchCustomerDetails();
            onRefreshAll();
          }}
        />
      )}

      {activeTab === 'QR' && currentCustomer && (
        <MemberQR
          customerId={currentCustomer.id}
          customerCode={currentCustomer.customerCode}
          customerName={currentCustomer.name}
        />
      )}

      {activeTab === 'PROFILE' && <MemberProfile />}

      {/* Invoice Details Modal */}
      {showInvoiceModal && (
        <InvoiceModal
          invoice={showInvoiceModal}
          onClose={() => setShowInvoiceModal(null)}
          onPayNow={handleInitiatePay}
          isCustomerView={true}
        />
      )}

      {/* Receipt Details Modal */}
      {showReceiptModal && (
        <ReceiptModal
          payment={showReceiptModal}
          onClose={() => setShowReceiptModal(null)}
        />
      )}

      {/* PhonePe Direct UPI Settlement Modal */}
      {showPayModal && selectedInvoiceToPay && (
        <PhonePeUpiModal
          isOpen={true}
          onClose={() => setShowPayModal(false)}
          invoiceId={selectedInvoiceToPay.id}
          invoiceNumber={selectedInvoiceToPay.invoiceNumber || selectedInvoiceToPay.id.slice(0, 8)}
          amount={parseFloat(payAmount) || Math.max(0, selectedInvoiceToPay.totalAmount - selectedInvoiceToPay.paidAmount)}
          customerName={currentCustomer.name}
          onPaymentRecorded={() => {
            fetchCustomerDetails();
            onRefreshAll();
          }}
        />
      )}
    </div>
  );
}
