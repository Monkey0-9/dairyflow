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
import { MemberQR } from './MemberQR';
import InvoiceModal from '../common/InvoiceModal';
import ReceiptModal from '../common/ReceiptModal';
import { useMilkFlowEvents, playNotificationChime } from '@/lib/use-milkflow-events';
import type { MilkFlowEvent } from '@/lib/events';
import { Button } from '@/components/ui/Button';
import { Droplets, CreditCard, ShieldCheck, Sparkles, QrCode, FileText, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CustomerPortalProps {
  currentUserId: string;
  customers: CustomerProfile[];
  onRefreshAll: () => void;
  initialTab?: 'HOME' | 'STATEMENTS' | 'CONCIERGE' | 'QR';
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
  const [activeTab, setActiveTab] = useState<'HOME' | 'STATEMENTS' | 'CONCIERGE' | 'QR'>(initialTab);
  const [conciergeInitialSheet, setConciergeInitialSheet] = useState<'pause' | 'extra' | 'qty' | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showInvoiceModal, setShowInvoiceModal] = useState<Invoice | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<Payment | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'UPI' | 'CASH' | 'ONLINE'>('UPI');
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [upiUri, setUpiUri] = useState<string>('');

  const currentCustomer: CustomerProfile | undefined =
    customers.find((c) => c.userId === currentUserId) || customers[0];

  const fetchCustomerDetails = useCallback(async () => {
    if (!currentCustomer) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/customer/dashboard?customerId=${currentCustomer.id}`);
      const data = await res.json();
      if (data.success) {
        setCustomerData(data);
        setPauseRequests(data.pauseRequests || []);
        setMilkRequests(data.extraMilkRequests || []);
        setTodayRecord(data.todayRecord || null);
      }
    } catch (err) {
      console.error('Failed to fetch client details', err);
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
    setPayError(null);
    setShowPayModal(true);

    // Fetch dynamic UPI deep-link
    fetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: target.id, amount: bal || target.totalAmount }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.upi?.uri) setUpiUri(d.upi.uri);
      })
      .catch(() => {});
  };

  const handleConfirmPayment = async () => {
    if (!selectedInvoiceToPay || !payAmount) return;
    const amt = parseFloat(payAmount);
    const outstanding = Math.max(
      0,
      selectedInvoiceToPay.totalAmount - selectedInvoiceToPay.paidAmount
    );
    if (!Number.isFinite(amt) || amt <= 0) {
      setPayError('Enter a valid settlement amount greater than ₹0.');
      return;
    }
    if (amt > outstanding + 0.01) {
      setPayError(
        `Amount cannot exceed the outstanding balance of ₹${outstanding.toFixed(2)}.`
      );
      return;
    }
    setIsPaying(true);
    setPayError(null);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: selectedInvoiceToPay.id,
          amount: parseFloat(payAmount),
          paymentMethod: payMethod,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowPayModal(false);
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        } catch {}
        fetchCustomerDetails();
        onRefreshAll();
      } else {
        setPayError(data.error || 'Payment recording failed. Please retry.');
      }
    } catch {
      setPayError('Connection error while recording settlement.');
    } finally {
      setIsPaying(false);
    }
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
    customerData?.subscriptions?.[0] || null;

  return (
    <div className="space-y-6">
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
            onClick={() => setActiveTab('QR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'QR'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Client Pass</span>
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
          onPayNow={() => handleInitiatePay()}
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

      {activeTab === 'QR' && (
        <MemberQR
          customerId={currentCustomer.id}
          customerCode={currentCustomer.customerCode}
          customerName={currentCustomer.name}
        />
      )}

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

      {/* Settlement Pay Modal */}
      {showPayModal && selectedInvoiceToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Statement Settlement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {payError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-xl">
                {payError}
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
              <div className="text-[11px] text-slate-500">Cycle Settlement:</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Invoice #{selectedInvoiceToPay.invoiceNumber || selectedInvoiceToPay.id.slice(0, 8)}
              </div>
              <div className="text-xs text-slate-500 pt-1">
                Outstanding:{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ₹
                  {Math.max(
                    0,
                    selectedInvoiceToPay.totalAmount - selectedInvoiceToPay.paidAmount
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="settlement-amount"
                className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5"
              >
                Settlement Amount (₹)
              </label>
              <input
                id="settlement-amount"
                type="number"
                step="0.01"
                min="1"
                max={Math.max(
                  0,
                  selectedInvoiceToPay.totalAmount - selectedInvoiceToPay.paidAmount
                )}
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="e.g. 1250.00"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {upiUri && (
              <a
                href={upiUri}
                className="w-full py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs flex items-center justify-center gap-2 transition"
              >
                <CreditCard className="w-4 h-4" />
                <span>Open UPI App (GPay / PhonePe / Paytm)</span>
              </a>
            )}

            <div className="space-y-3 pt-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Or Confirm Settlement Method
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['UPI', 'ONLINE', 'CASH'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      payMethod === m
                        ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-black'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowPayModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={isPaying}
                onClick={handleConfirmPayment}
                className="flex-1"
                rightIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Record Settlement
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
