'use client';

import React, { useState, useEffect } from 'react';
import {
  Droplets,
  Calendar,
  AlertTriangle,
  CreditCard,
  QrCode,
  CheckCircle2,
  Clock,
  Send,
  Printer,
  ChevronRight,
  ShieldCheck,
  Download,
  Palmtree,
  Plus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import {
  CustomerProfile,
  Subscription,
  Invoice,
  Payment,
  DeliveryRecord,
  PaymentMethod,
  PauseRequest,
  ExtraMilkRequest,
} from '@/lib/types';
import InvoiceModal from '../common/InvoiceModal';
import ReceiptModal from '../common/ReceiptModal';

interface CustomerPortalProps {
  currentUserId: string;
  customers: CustomerProfile[];
  onRefreshAll: () => void;
}

export default function CustomerPortal({
  currentUserId,
  customers,
  onRefreshAll,
}: CustomerPortalProps) {
  const [customerData, setCustomerData] = useState<any>(null);
  const [pauseRequests, setPauseRequests] = useState<PauseRequest[]>([]);
  const [milkRequests, setMilkRequests] = useState<ExtraMilkRequest[]>([]);
  const [todayRecord, setTodayRecord] = useState<DeliveryRecord | null>(null);
  const [activeTab, setActiveTab] = useState<
    'HOME' | 'CALENDAR' | 'BILLING' | 'VACATION' | 'REPORT_ISSUE' | 'QR'
  >('HOME');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showInvoiceModal, setShowInvoiceModal] = useState<Invoice | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<Payment | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('UPI');
  const [isPaying, setIsPaying] = useState(false);

  // Issue Reporting Form
  const [issueDate, setIssueDate] = useState('2026-09-16');
  const [issueClaimedQty, setIssueClaimedQty] = useState('0');
  const [issueReason, setIssueReason] = useState('DID_NOT_RECEIVE');
  const [issueNote, setIssueNote] = useState('');
  const [issueSuccess, setIssueSuccess] = useState(false);

  // Vacation Form
  const [vacStart, setVacStart] = useState('2026-09-20');
  const [vacEnd, setVacEnd] = useState('2026-09-25');
  const [vacReason, setVacReason] = useState('Family holiday to native village');
  const [vacSuccess, setVacSuccess] = useState(false);

  // Extra Milk Form
  const [extraStart, setExtraStart] = useState('2026-09-18');
  const [extraEnd, setExtraEnd] = useState('2026-09-19');
  const [extraQty, setExtraQty] = useState('2.0');
  const [extraReason, setExtraReason] = useState('Guests arriving for festival');
  const [extraSuccess, setExtraSuccess] = useState(false);

  // QR Code Data URL
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  // Find customer matching current persona
  const currentCustomer =
    customers.find((c) => c.userId === currentUserId) || customers[0];

  const fetchCustomerDetails = async () => {
    if (!currentCustomer) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?id=${currentCustomer.id}`);
      const data = await res.json();
      if (data.success) {
        setCustomerData(data);
      }

      // Fetch customer dashboard for scoped requests
      const dashRes = await fetch(`/api/customer/dashboard?customerId=${currentCustomer.id}`);
      const dashData = await dashRes.json();
      if (dashData.success && dashData.data) {
        setPauseRequests(dashData.data.pauseRequests || []);
        setMilkRequests(dashData.data.milkRequests || []);
      }

      // Fetch today's delivery record
      const todayRes = await fetch(`/api/ledger?date=2026-09-16`);
      const todayData = await todayRes.json();
      if (todayData.success) {
        const myToday = todayData.records.find(
          (r: DeliveryRecord) => r.customerId === currentCustomer.id
        );
        setTodayRecord(myToday || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetails();
  }, [currentCustomer?.id, currentUserId]);

  // Generate QR Code
  useEffect(() => {
    if (currentCustomer) {
      const payload = JSON.stringify({
        code: currentCustomer.customerCode,
        name: currentCustomer.name,
        phone: currentCustomer.phone,
        address: currentCustomer.address,
      });

      QRCode.toDataURL(payload, { width: 280, margin: 2 }, (err, url) => {
        if (!err && url) setQrCodeUrl(url);
      });
    }
  }, [currentCustomer]);

  if (loading || !customerData) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">
        <Droplets className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
        <div>Loading your milk account...</div>
      </div>
    );
  }

  const latestInvoice: Invoice | undefined = customerData.invoices?.find(
    (i: Invoice) => i.month === 9 && i.year === 2026
  ) || customerData.invoices?.[0];

  const totalLitresMonth = latestInvoice?.totalQuantity || 27.0;
  const estimatedBill = latestInvoice?.totalAmount || 1350;
  const amountPaid = latestInvoice?.paidAmount || 1000;
  const outstandingDue = latestInvoice?.outstandingAmount || 350;

  // Submit Issue Dispute
  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todayRecord) return;
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentCustomer.id,
          deliveryRecordId: todayRecord.id,
          claimedQuantity: parseFloat(issueClaimedQty),
          reason: issueReason,
          customerNote: issueNote || "Customer reported they didn't receive milk",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIssueSuccess(true);
        fetchCustomerDetails();
        onRefreshAll();
        setTimeout(() => setIssueSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Vacation Pause
  const handleScheduleVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customer/pause-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentCustomer.id,
          startDate: vacStart,
          endDate: vacEnd,
          reason: vacReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVacSuccess(true);
        fetchCustomerDetails();
        onRefreshAll();
        setTimeout(() => setVacSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Extra Milk Request
  const handleScheduleExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customer/milk-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentCustomer.id,
          date: extraStart,
          requestedQuantity: parseFloat(extraQty),
          reason: extraReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExtraSuccess(true);
        fetchCustomerDetails();
        onRefreshAll();
        setTimeout(() => setExtraSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Online Payment
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!latestInvoice) return;
    setIsPaying(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: latestInvoice.id,
          amount: parseFloat(payAmount),
          paymentMethod: payMethod,
          transactionRef: `UPI-${Date.now()}`,
          note: `Online payment via ${payMethod}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPayModal(false);
        // Trigger celebratory confetti!
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#059669', '#10b981', '#34d399', '#f59e0b'],
        });
        setShowReceiptModal(data.payment);
        fetchCustomerDetails();
        onRefreshAll();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200 bg-emerald-900/60 px-2.5 py-0.5 rounded-full border border-emerald-700">
              Customer Portal • {currentCustomer.customerCode}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight">
              Welcome back, {currentCustomer.name} 👋
            </h1>
            <p className="text-xs text-emerald-100 mt-1">
              GreenValley Dairy Farm • {customerData.subscription?.productName || 'Fresh Cow Milk'} •{' '}
              {customerData.subscription?.defaultQuantity} L / day
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('QR')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border border-white/20 transition"
            >
              <QrCode className="w-4 h-4 text-emerald-300" />
              <span>Door QR Card</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards: Today's Milk + Month Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Milk Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                Today's Delivery
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">16 Sep</span>
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-2">
              {todayRecord ? todayRecord.deliveredQuantity : customerData.subscription?.defaultQuantity}{' '}
              <span className="text-sm font-bold text-slate-400">L</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span
              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                todayRecord?.status === 'DELIVERED' || todayRecord?.status === 'EXTRA'
                  ? 'bg-emerald-100 text-emerald-800'
                  : todayRecord?.status === 'SKIPPED'
                  ? 'bg-slate-200 text-slate-700'
                  : todayRecord?.status === 'PARTIAL'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {todayRecord?.status || 'DELIVERED'}
            </span>

            {todayRecord && !todayRecord.hasDispute && (
              <button
                onClick={() => setActiveTab('REPORT_ISSUE')}
                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 transition"
              >
                Report Issue
              </button>
            )}
          </div>
        </div>

        {/* Total Consumed Month */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              September Milk
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-2">
              {totalLitresMonth}{' '}
              <span className="text-sm font-bold text-slate-400">L</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            @ ₹{customerData.subscription?.customPricePerUnit || 50} / Litre
          </div>
        </div>

        {/* Estimated Bill */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total September Bill
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-2">
              ₹{estimatedBill.toLocaleString()}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-emerald-600 font-semibold">
            ₹{amountPaid.toLocaleString()} paid so far
          </div>
        </div>

        {/* Outstanding Due + Pay Now Button */}
        <div className="bg-white p-5 rounded-3xl border-2 border-rose-200 bg-rose-50/20 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                Balance Due
              </span>
              <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.2 rounded-full font-bold">
                Due Oct 05
              </span>
            </div>
            <div className="text-2xl font-black text-rose-600 font-mono mt-2">
              ₹{outstandingDue.toLocaleString()}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-rose-100">
            {outstandingDue > 0 ? (
              <button
                onClick={() => {
                  setPayAmount(outstandingDue.toString());
                  setShowPayModal(true);
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay ₹{outstandingDue} Now</span>
              </button>
            ) : (
              <div className="text-center text-xs font-bold text-emerald-600 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Fully Paid!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none text-xs font-bold">
        {[
          { id: 'HOME', label: 'Overview' },
          { id: 'CALENDAR', label: 'Monthly Consumption' },
          { id: 'BILLING', label: 'Invoices & Receipts' },
          { id: 'VACATION', label: 'Pause / Vacation Mode' },
          { id: 'REPORT_ISSUE', label: 'Report Issue' },
          { id: 'QR', label: 'My Door QR' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview / Home */}
      {activeTab === 'HOME' && (
        <div className="space-y-6">
          {/* Active Dispute Notice if any */}
          {todayRecord?.hasDispute && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  Dispute Claim Under Review by Farmer
                </h4>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  You reported an issue for 16 Sep. Farmer Suresh Patel has been notified and will
                  verify and adjust your ledger record shortly.
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setActiveTab('VACATION')}
              className="p-5 bg-white rounded-3xl border border-slate-200 hover:border-emerald-500 text-left transition shadow-xs hover:shadow-md group"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <Palmtree className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">
                Going on Vacation?
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Pause deliveries for any date range with zero paper notes.
              </p>
            </button>

            <button
              onClick={() => setActiveTab('REPORT_ISSUE')}
              className="p-5 bg-white rounded-3xl border border-slate-200 hover:border-emerald-500 text-left transition shadow-xs hover:shadow-md group"
            >
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">
                Didn't Receive Milk?
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Report missed or partial delivery for instant ledger adjustment.
              </p>
            </button>

            <button
              onClick={() => setActiveTab('BILLING')}
              className="p-5 bg-white rounded-3xl border border-slate-200 hover:border-emerald-500 text-left transition shadow-xs hover:shadow-md group"
            >
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <CreditCard className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">
                Instant UPI Payment
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Pay your monthly milk invoice and download official receipts.
              </p>
            </button>
          </div>

          {/* Recent Deliveries Snapshot */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900">Recent Delivery Ledger Activity</h3>
              <button
                onClick={() => setActiveTab('CALENDAR')}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                View Full Month Calendar →
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-3 flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-900">16 Sep 2026 (Today)</span>
                  <span className="text-slate-400 ml-2">Morning 06:30 AM</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold">
                    {todayRecord ? `${todayRecord.deliveredQuantity} L` : '1.0 L'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {todayRecord?.status || 'DELIVERED'}
                  </span>
                </div>
              </div>

              <div className="py-3 flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-900">15 Sep 2026</span>
                  <span className="text-slate-400 ml-2">Morning 06:30 AM</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold">1.0 L</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    DELIVERED
                  </span>
                </div>
              </div>

              <div className="py-3 flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-900">14 Sep 2026</span>
                  <span className="text-slate-400 ml-2">Morning 06:30 AM</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold">1.0 L</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    DELIVERED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Monthly Calendar */}
      {activeTab === 'CALENDAR' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              September 2026 Milk Consumption
            </h3>
            <p className="text-xs text-slate-500">
              Your daily delivered record, skips, and partial amounts verified by digital ledger
            </p>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => (
              <div key={w} className="font-bold text-slate-400 py-1 uppercase text-[10px]">
                {w}
              </div>
            ))}

            {/* Blank placeholder for Sep 1 (Tue) */}
            <div className="aspect-square bg-slate-50/50 rounded-2xl border border-slate-100 opacity-40" />

            {/* Days 1-20 */}
            {Array.from({ length: 20 }, (_, i) => {
              const day = i + 1;
              const isToday = day === 16;
              const isFuture = day > 16;
              const isSkipped = day === 4; // realistic skip

              return (
                <div
                  key={day}
                  className={`aspect-square p-2 rounded-2xl border flex flex-col justify-between items-center transition ${
                    isToday
                      ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                      : isSkipped
                      ? 'border-rose-200 bg-rose-50/30'
                      : isFuture
                      ? 'border-dashed border-slate-200 bg-slate-50/50 opacity-60'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className={`text-xs font-mono font-bold ${isToday ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {day}
                  </span>

                  <div className="text-center font-mono text-xs">
                    {isSkipped ? (
                      <span className="font-bold text-rose-600">0 L</span>
                    ) : isFuture ? (
                      <span className="text-slate-400">1 L</span>
                    ) : (
                      <span className="font-bold text-emerald-700">1 L</span>
                    )}
                  </div>

                  <span
                    className={`text-[9px] font-bold uppercase ${
                      isSkipped ? 'text-rose-600' : isFuture ? 'text-slate-400' : 'text-emerald-600'
                    }`}
                  >
                    {isSkipped ? 'Skip' : isFuture ? 'Plan' : '✓'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Invoices & Receipts */}
      {activeTab === 'BILLING' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Monthly Invoices</h3>
                <p className="text-xs text-slate-500">Official dairy invoices and receipts</p>
              </div>

              {latestInvoice && (
                <button
                  onClick={() => setShowInvoiceModal(latestInvoice)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>View Printable Bill</span>
                </button>
              )}
            </div>

            {latestInvoice ? (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {latestInvoice.invoiceNumber}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        latestInvoice.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {latestInvoice.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    September 2026 • {latestInvoice.totalQuantity} Litres delivered
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right font-mono">
                    <div className="text-xs text-slate-500">Total: ₹{latestInvoice.totalAmount}</div>
                    <div className="text-sm font-black text-rose-600">
                      Due: ₹{latestInvoice.outstandingAmount}
                    </div>
                  </div>

                  {latestInvoice.outstandingAmount > 0 && (
                    <button
                      onClick={() => {
                        setPayAmount(latestInvoice.outstandingAmount.toString());
                        setShowPayModal(true);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                    >
                      Pay Now
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">No invoices generated yet.</div>
            )}
          </div>

          {/* Payment Receipts History */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Payment History & Receipts</h3>
            <div className="divide-y divide-slate-100 text-xs">
              {customerData.payments?.map((p: Payment) => (
                <div key={p.id} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800">{p.receiptNumber}</span>
                      <span className="text-emerald-700 font-bold uppercase text-[10px] bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                        {p.paymentMethod}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(p.paidAt).toLocaleString()} • Ref: {p.transactionRef}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold font-mono text-emerald-600">
                      ₹{p.amount.toLocaleString()}
                    </span>
                    <button
                      onClick={() => setShowReceiptModal(p)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
                    >
                      Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Pause / Vacation Mode */}
      {activeTab === 'VACATION' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vacation Pause Form */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Palmtree className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-extrabold text-slate-900">Pause Milk (Vacation)</h3>
            </div>
            <p className="text-xs text-slate-500">
              Going away? Schedule pause dates in advance. Days on vacation are automatically marked
              SKIPPED and zero rupees are billed.
            </p>

            {vacSuccess && (
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Vacation scheduled! Milk delivery paused for those dates.</span>
              </div>
            )}

            <form onSubmit={handleScheduleVacation} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Pause Start Date *</label>
                <input
                  type="date"
                  required
                  value={vacStart}
                  onChange={(e) => setVacStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Pause End Date (Inclusive) *</label>
                <input
                  type="date"
                  required
                  value={vacEnd}
                  onChange={(e) => setVacEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason</label>
                <input
                  type="text"
                  value={vacReason}
                  onChange={(e) => setVacReason(e.target.value)}
                  placeholder="e.g. Vacation to village, Out of station"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs transition"
              >
                Confirm Vacation Pause
              </button>
            </form>
          </div>

          {/* Temporary Extra Milk Request */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-extrabold text-slate-900">Request Extra Milk (Guests)</h3>
            </div>
            <p className="text-xs text-slate-500">
              Need extra milk for relatives or festival cooking? Request temporary quantity without
              altering your regular subscription.
            </p>

            {extraSuccess && (
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Extra milk scheduled on ledger!</span>
              </div>
            )}

            <form onSubmit={handleScheduleExtra} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Start Date *</label>
                <input
                  type="date"
                  required
                  value={extraStart}
                  onChange={(e) => setExtraStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target End Date *</label>
                <input
                  type="date"
                  required
                  value={extraEnd}
                  onChange={(e) => setExtraEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Requested Total Litres *</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="10"
                  required
                  value={extraQty}
                  onChange={(e) => setExtraQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason</label>
                <input
                  type="text"
                  value={extraReason}
                  onChange={(e) => setExtraReason(e.target.value)}
                  placeholder="e.g. Guests visiting for birthday function"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition cursor-pointer"
              >
                Request Extra Milk
              </button>
            </form>
          </div>

          {/* Live Request Status Tracker */}
          <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  My Requests & Scheduling Tracker
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Connected to Suresh Patel (Farmer) • Server Synchronized
              </span>
            </div>

            {pauseRequests.length === 0 && milkRequests.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No active or recent requests. Use the forms above to request vacation pauses or extra milk.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pauseRequests.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">Vacation Pause</span>
                        <span className="font-mono bg-amber-50 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-200">
                          {p.startDate} to {p.endDate}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            p.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-900'
                              : p.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-rose-100 text-rose-900'
                          }`}
                        >
                          {p.status === 'PENDING'
                            ? '⏳ Awaiting Farmer Review'
                            : p.status === 'APPROVED'
                            ? '✓ Approved (Days Skipped)'
                            : '✕ Declined'}
                        </span>
                      </div>
                      <div className="text-slate-600 italic">&ldquo;{p.reason}&rdquo;</div>
                      {p.rejectionReason && (
                        <div className="text-rose-700 font-medium">
                          Note from Farmer: {p.rejectionReason}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 shrink-0">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}

                {milkRequests.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900">Extra Milk</span>
                        <span className="font-mono bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded font-bold border border-emerald-200">
                          {m.date}: {m.requestedQuantity} L
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            m.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-900'
                              : m.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-rose-100 text-rose-900'
                          }`}
                        >
                          {m.status === 'PENDING'
                            ? '⏳ Awaiting Farmer Review'
                            : m.status === 'APPROVED'
                            ? '✓ Approved'
                            : '✕ Declined'}
                        </span>
                      </div>
                      <div className="text-slate-600 italic">&ldquo;{m.reason}&rdquo;</div>
                      {m.rejectionReason && (
                        <div className="text-rose-700 font-medium">
                          Note from Farmer: {m.rejectionReason}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 shrink-0">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Report Issue / Dispute */}
      {activeTab === 'REPORT_ISSUE' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs max-w-xl mx-auto space-y-5">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <span>Report Delivery Discrepancy</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Did not receive milk today or received wrong quantity? Submit a claim and the farmer
              will verify and reconcile your ledger immediately.
            </p>
          </div>

          {issueSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Dispute claim submitted successfully! Farmer has been alerted on their dashboard.
              </span>
            </div>
          )}

          <form onSubmit={handleReportIssue} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Delivery Date *</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between">
              <span className="text-slate-600">Currently Recorded on Ledger:</span>
              <span className="font-bold text-slate-900 font-mono">
                {todayRecord ? `${todayRecord.deliveredQuantity} L` : '1.0 L'}
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">What happened? *</label>
              <div className="space-y-1.5">
                {[
                  { id: 'DID_NOT_RECEIVE', label: "○ Didn't receive milk (0 L delivered)" },
                  { id: 'TOOK_LESS', label: '○ Took less than recorded' },
                  { id: 'TOOK_MORE', label: '○ Took more than recorded' },
                  { id: 'WRONG_QUANTITY', label: '○ Wrong quantity marked' },
                  { id: 'QUALITY_ISSUE', label: '○ Milk curdled / quality issue' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer font-medium"
                  >
                    <input
                      type="radio"
                      name="issueReason"
                      value={opt.id}
                      checked={issueReason === opt.id}
                      onChange={(e) => {
                        setIssueReason(e.target.value);
                        if (e.target.value === 'DID_NOT_RECEIVE') setIssueClaimedQty('0');
                      }}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Actual Litres Received by You:
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={issueClaimedQty}
                onChange={(e) => setIssueClaimedQty(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Note for Farmer:</label>
              <textarea
                rows={3}
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
                placeholder="Explain what happened so farmer can verify..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs transition"
            >
              Submit Issue to Farmer
            </button>
          </form>
        </div>
      )}

      {/* Tab: Door QR Card */}
      {activeTab === 'QR' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs max-w-sm mx-auto text-center space-y-4">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            GreenValley Dairy Farm
          </div>
          <h3 className="text-xl font-black text-slate-900">{currentCustomer.name}</h3>
          <p className="text-xs font-mono font-bold text-slate-500">ID: {currentCustomer.customerCode}</p>

          <div className="p-4 bg-white rounded-3xl border-2 border-slate-200 inline-block shadow-sm">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="Door QR" className="w-48 h-48 mx-auto" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                Generating QR...
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl text-xs text-slate-700 text-left space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Subscribed Milk:</span>
              <span className="font-bold">{customerData.subscription?.productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Normal Litres:</span>
              <span className="font-bold font-mono">
                {customerData.subscription?.defaultQuantity} L
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Time:</span>
              <span className="font-semibold">{currentCustomer.deliveryTime}</span>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Door QR Sticker</span>
          </button>
        </div>
      )}

      {/* Online Pay Now Modal */}
      {showPayModal && latestInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <h3 className="text-base font-extrabold text-slate-900">Pay Milk Bill Online</h3>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="p-6 space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-center">
                <span className="text-xs text-emerald-800 font-semibold">Paying Outstanding Bill</span>
                <div className="text-3xl font-black text-emerald-700 font-mono mt-1">
                  ₹{payAmount}
                </div>
                <div className="text-[11px] text-emerald-600 mt-1">
                  Payable to: <strong>greenvalley@okaxis</strong>
                </div>
              </div>

              {/* Simulated UPI Apps / QR */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Select Payment Mode:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod('UPI')}
                    className={`p-3 rounded-2xl border text-left font-bold flex items-center justify-between ${
                      payMethod === 'UPI'
                        ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>📱 UPI Apps / GPay</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod('CARD')}
                    className={`p-3 rounded-2xl border text-left font-bold flex items-center justify-between ${
                      payMethod === 'CARD'
                        ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>💳 Debit / Credit Card</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-2 text-[11px] text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>256-bit SSL encrypted • Instant webhook ledger verification</span>
              </div>

              <button
                type="submit"
                disabled={isPaying}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
              >
                {isPaying ? 'Verifying Gateway...' : `Authorize & Pay ₹${payAmount}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceModal
          invoice={showInvoiceModal}
          onClose={() => setShowInvoiceModal(null)}
          onPayNow={(inv) => {
            setShowInvoiceModal(null);
            setPayAmount(inv.outstandingAmount.toString());
            setShowPayModal(true);
          }}
          isCustomerView={true}
        />
      )}

      {/* Receipt Modal */}
      {showReceiptModal && (
        <ReceiptModal
          payment={showReceiptModal}
          onClose={() => setShowReceiptModal(null)}
        />
      )}
    </div>
  );
}
