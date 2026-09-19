'use client';

import {
  Droplets,
  ShieldCheck,
  CreditCard,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
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
    <div className="space-y-6">
      {/* Hero Welcome & Provenance Assurance */}
      <div className="rounded-3xl bg-linear-to-r from-slate-950 via-slate-900 to-emerald-950 text-white p-7 sm:p-9 shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold">
                Private Reserve • Client Allocation
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome, {customer.name}
            </h1>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5 font-medium">
              <span>Client Portfolio: <span className="font-mono text-amber-300 font-bold">{customer.customerCode || 'PR-001'}</span></span>
              <span>•</span>
              <span>{customer.address}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenQR}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Client Pass</span>
            </button>
            <Button
              variant="gold"
              size="sm"
              onClick={() => onOpenConcierge('pause')}
              leftIcon={<Calendar className="w-3.5 h-3.5" />}
            >
              Concierge
            </Button>
          </div>
        </div>

        {/* Primary Allocation Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Daily Allotment
            </div>
            <div className="text-xl font-black font-mono text-white mt-1 tabular-nums">
              {subscription?.defaultQuantity || 1.0} <span className="text-xs font-normal text-slate-400">L</span>
            </div>
            <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
              {subscription?.productName || 'Single-Estate A2 Milk'}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Today&#39;s Status
            </div>
            <div className="text-xl font-black mt-1">
              {isDeliveredToday ? (
                <span className="text-emerald-400 flex items-center gap-1 text-base font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Fulfilled
                </span>
              ) : isSkippedToday ? (
                <span className="text-amber-400 flex items-center gap-1 text-base font-bold">
                  Paused
                </span>
              ) : (
                <span className="text-slate-300 flex items-center gap-1 text-base font-bold">
                  <Clock className="w-4 h-4 text-amber-400" /> Dispatched
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Shift: 06:00 – 07:30 AM
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Ledger Settlement
            </div>
            <div className="text-xl font-black font-mono text-white mt-1 tabular-nums">
              ₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {balanceDue > 0 ? 'Current cycle balance' : 'Zero balance due'}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Cold-Chain Grade
            </div>
            <div className="text-xl font-black text-amber-300 mt-1 flex items-center gap-1">
              <Award className="w-4 h-4 text-amber-400" /> Grade A+
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Chilled &lt; 4°C at bottling
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Today Delivery & Settlement Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Today's Delivery Assurance */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Today&#39;s Doorstep Delivery
                </h3>
                <p className="text-[11px] text-slate-500">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            {isDeliveredToday ? (
              <Badge variant="emerald">Delivered</Badge>
            ) : isSkippedToday ? (
              <Badge variant="warning">Paused</Badge>
            ) : (
              <Badge variant="info">In Transit</Badge>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Volume Scheduled:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{subscription?.defaultQuantity || 1.0} Litres</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Volume Received:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {isDeliveredToday ? `${todayRecord?.deliveredQuantity || subscription?.defaultQuantity || 1.0} Litres` : 'Pending Doorstep Delivery'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bottles Returned:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {todayRecord?.bottlesReturned ? `${todayRecord.bottlesReturned} glass bottles` : 'Recorded at delivery'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Cryptographically verified fulfillment
            </span>
            <button
              type="button"
              onClick={() => onOpenConcierge('extra')}
              className="text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              Request Extra Reserve →
            </button>
          </div>
        </Card>

        {/* Card 2: Financial Statement & Instant Pay */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Current Statement Balance
                </h3>
                <p className="text-[11px] text-slate-500">
                  {latestInvoice ? `Invoice #${latestInvoice.invoiceNumber || 'INV-CURRENT'}` : 'Up to date'}
                </p>
              </div>
            </div>

            {balanceDue > 0 ? (
              <Badge variant="warning">Action Required</Badge>
            ) : (
              <Badge variant="emerald">Settled</Badge>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Payable Balance:</span>
              <span className="text-xl font-black font-mono text-slate-950 dark:text-white tabular-nums">
                ₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {latestInvoice?.dueDate && (
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{latestInvoice.dueDate}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            {balanceDue > 0 ? (
              <Button
                variant="primary"
                size="md"
                onClick={onPayNow}
                className="flex-1"
                leftIcon={<CreditCard className="w-4 h-4" />}
              >
                Settle Now via UPI
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
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
            >
              Statement History
            </button>
          </div>
        </Card>
      </div>

      {/* Concierge Services Quick Bar */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
          Private Client Concierge Services
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onOpenConcierge('pause')}
            className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-[#FBFBFC] dark:bg-slate-900 text-left hover:border-amber-500/40 transition cursor-pointer group"
          >
            <Calendar className="w-5 h-5 text-amber-600 mb-2 group-hover:scale-105 transition-transform" />
            <div className="font-bold text-xs text-slate-900 dark:text-white">Pause for Travel</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Travel hold with 1-click resumption</div>
          </button>

          <button
            type="button"
            onClick={() => onOpenConcierge('extra')}
            className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-[#FBFBFC] dark:bg-slate-900 text-left hover:border-emerald-600/40 transition cursor-pointer group"
          >
            <Sparkles className="w-5 h-5 text-emerald-600 mb-2 group-hover:scale-105 transition-transform" />
            <div className="font-bold text-xs text-slate-900 dark:text-white">Extra Milk for Occasions</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Request additional liters for guests</div>
          </button>

          <button
            type="button"
            onClick={() => onOpenConcierge('qty')}
            className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-[#FBFBFC] dark:bg-slate-900 text-left hover:border-blue-500/40 transition cursor-pointer group"
          >
            <TrendingUp className="w-5 h-5 text-blue-600 mb-2 group-hover:scale-105 transition-transform" />
            <div className="font-bold text-xs text-slate-900 dark:text-white">Adjust Allocation Tier</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Modify ongoing daily bottle quota</div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MemberHome;
