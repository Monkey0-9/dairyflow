'use client';

import {
  Droplets,
  ShieldCheck,
  CreditCard,
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  QrCode,
} from 'lucide-react';
import { CustomerProfile, DeliveryRecord, Subscription, Invoice } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

interface MemberHomeProps {
  customer: CustomerProfile;
  todayRecord: DeliveryRecord | null;
  subscription: Subscription | null;
  latestInvoice: Invoice | null;
  onPayNow: () => void;
  onOpenStatements: () => void;
  onOpenConcierge: (tab: 'pause' | 'extra' | 'qty') => void;
  onOpenQR: () => void;
}

export function MemberHome({
  customer,
  todayRecord,
  subscription,
  latestInvoice,
  onPayNow,
  onOpenStatements,
  onOpenConcierge,
  onOpenQR,
}: MemberHomeProps) {
  const isDeliveredToday = todayRecord && (todayRecord.status === 'DELIVERED' || todayRecord.status === 'EXTRA');
  const isSkippedToday = todayRecord?.status === 'SKIPPED';
  const balanceDue = latestInvoice ? Math.max(0, latestInvoice.totalAmount - latestInvoice.paidAmount) : 0;

  return (
    <div className="space-y-5">
      {/* Account Header */}
      <div className="rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="live" dot size="sm">{customer.customerCode || 'N/A'}</Badge>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Active Allocation</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {customer.name}&apos;s Account
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {customer.address}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenQR}
              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-500" />
              <span>UPI / QR</span>
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenConcierge('pause')}
              leftIcon={<Calendar className="w-3.5 h-3.5" />}
            >
              Delivery Controls
            </Button>
          </div>
        </div>

        {/* Allocation Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider">
              Daily Allotment
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1.5 tabular-nums">
              {subscription?.defaultQuantity || 1.0} <span className="text-xs font-normal text-slate-400">L</span>
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              {subscription?.productName || 'Standard Milk'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider">
              Today&apos;s Status
            </div>
            <div className="text-sm font-semibold mt-1.5">
              {isDeliveredToday ? (
                <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fulfilled
                </span>
              ) : isSkippedToday ? (
                <span className="text-amber-600 dark:text-amber-400">On Hold</span>
              ) : (
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Scheduled
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              06:00 – 07:30 AM
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider">
              Cycle Balance
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1.5 tabular-nums">
              ₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              {balanceDue > 0 ? 'Outstanding' : 'Settled'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <div className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider">
              Quality Grade
            </div>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Grade A+
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Direct from Dairy Farm</div>
          </div>
        </div>
      </div>

      {/* Delivery + Settlement Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's Delivery */}
        <Card className="p-5 space-y-4" hover={false}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center">
                <Droplets className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                  Today&apos;s Delivery
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
            {isDeliveredToday ? (
              <Badge variant="success">Delivered</Badge>
            ) : isSkippedToday ? (
              <Badge variant="warning">On Hold</Badge>
            ) : (
              <Badge variant="info">In Transit</Badge>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Volume Scheduled</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">{subscription?.defaultQuantity || 1.0} L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Volume Received</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                {isDeliveredToday ? `${todayRecord?.deliveredQuantity || subscription?.defaultQuantity || 1.0} L` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Bottles Returned</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                {todayRecord?.bottlesReturned ? `${todayRecord.bottlesReturned}` : '—'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Cryptographically verified
            </span>
            <button
              type="button"
              onClick={() => onOpenConcierge('extra')}
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Request Supplementary
            </button>
          </div>
        </Card>

        {/* Settlement Card */}
        <Card className="p-5 space-y-4" hover={false}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                  Statement Balance
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {latestInvoice ? `Invoice #${latestInvoice.invoiceNumber || 'CURRENT'}` : 'Current cycle'}
                </p>
              </div>
            </div>
            {balanceDue > 0 ? (
              <Badge variant="warning">Outstanding</Badge>
            ) : (
              <Badge variant="success">Settled</Badge>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500 dark:text-slate-400">Payable Balance</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                ₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {latestInvoice?.dueDate && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Due Date</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 tabular-nums">{latestInvoice.dueDate}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 pt-0.5">
            {balanceDue > 0 ? (
              <Button
                variant="primary"
                size="md"
                onClick={onPayNow}
                className="flex-1"
                leftIcon={<CreditCard className="w-4 h-4" />}
              >
                Settle via UPI
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                disabled
                className="flex-1"
                leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              >
                Account Settled
              </Button>
            )}
            <button
              type="button"
              onClick={onOpenStatements}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              History
            </button>
          </div>
        </Card>
      </div>

      {/* Delivery Controls */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
          Delivery Controls
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            {
              key: 'pause' as const,
              icon: <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
              title: 'Delivery Hold',
              sub: 'Suspend delivery for travel or leave',
              accent: 'hover:border-amber-400/30',
            },
            {
              key: 'extra' as const,
              icon: <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
              title: 'Supplementary Volume',
              sub: 'Request additional litres for the day',
              accent: 'hover:border-emerald-500/30',
            },
            {
              key: 'qty' as const,
              icon: <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
              title: 'Modify Subscription',
              sub: 'Adjust ongoing daily allocation quota',
              accent: 'hover:border-blue-400/30',
            },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onOpenConcierge(item.key)}
              className={`p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-left hover:bg-white dark:hover:bg-slate-900 ${item.accent} transition cursor-pointer`}
            >
              {item.icon}
              <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 mt-2">{item.title}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{item.sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MemberHome;
