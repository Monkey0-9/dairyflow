'use client';

import React, { useState, useEffect } from 'react';
import { PauseRequest, ExtraMilkRequest } from '@/lib/types';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

interface MemberConciergeProps {
  customerId: string;
  farmerId: string;
  pauseRequests: PauseRequest[];
  milkRequests: ExtraMilkRequest[];
  onRefresh: () => void;
  defaultSheet?: 'pause' | 'extra' | 'qty' | null;
  onCloseSheet?: () => void;
}

export function MemberConcierge({
  customerId,
  farmerId,
  pauseRequests,
  milkRequests,
  onRefresh,
  defaultSheet = null,
  onCloseSheet,
}: MemberConciergeProps) {
  const [activeSheet, setActiveSheet] = useState<'pause' | 'extra' | 'qty' | null>(defaultSheet);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Vacation / Pause Form
  const [pauseStartDate, setPauseStartDate] = useState('');
  const [pauseEndDate, setPauseEndDate] = useState('');
  const [pauseReason, setPauseReason] = useState('Travel / Vacation');

  // Extra Milk Form
  const [extraDate, setExtraDate] = useState('');
  const [extraQty, setExtraQty] = useState('1.0');
  const [extraReason, setExtraReason] = useState('Dinner Party / Family Event');

  // Daily Quota / Allocation Tier Form
  const [qtyEffectiveDate, setQtyEffectiveDate] = useState('');
  const [qtyNewQuantity, setQtyNewQuantity] = useState('1.0');
  const [qtyReason, setQtyReason] = useState('Increase daily allocation');

  // Keep sheet in sync when parent requests a specific sheet
  // (e.g. "Adjust Allocation Tier" button on the Home tab).
  useEffect(() => {
    if (defaultSheet) {
      setActiveSheet(defaultSheet);
      setActionError(null);
      setActionSuccess(null);
    }
  }, [defaultSheet]);

  const handleClose = () => {
    setActiveSheet(null);
    setActionError(null);
    setActionSuccess(null);
    if (onCloseSheet) onCloseSheet();
  };

  const handleCreatePause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pauseStartDate || !pauseEndDate) {
      setActionError('Departure date and return date are both required.');
      return;
    }
    if (pauseStartDate > pauseEndDate) {
      setActionError('Return date must be on or after the departure date.');
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/customer/pause-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          farmerId,
          startDate: pauseStartDate,
          endDate: pauseEndDate,
          reason: pauseReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess('Vacation hold registered. Deliveries will pause automatically.');
        setTimeout(() => {
          handleClose();
          onRefresh();
        }, 1200);
      } else {
        setActionError(data.error || 'Failed to submit vacation hold.');
      }
    } catch {
      setActionError('Connection error. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraDate || !extraQty) {
      setActionError('Date and quantity are required.');
      return;
    }
    const qty = parseFloat(extraQty);
    if (!Number.isFinite(qty) || qty < 0.5 || qty > 20) {
      setActionError('Additional quantity must be between 0.5 L and 20 L.');
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/customer/milk-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          farmerId,
          date: extraDate,
          requestedQuantity: qty,
          reason: extraReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess('Extra milk request submitted to the estate concierge.');
        setTimeout(() => {
          handleClose();
          onRefresh();
        }, 1200);
      } else {
        setActionError(data.error || 'Failed to submit request.');
      }
    } catch {
      setActionError('Connection error. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateQtyChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qtyEffectiveDate || !qtyNewQuantity) {
      setActionError('Effective date and new daily quantity are both required.');
      return;
    }
    const qty = parseFloat(qtyNewQuantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 50) {
      setActionError('New daily quantity must be between 0.5 L and 50 L.');
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/customer/quantity-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          farmerId,
          effectiveDate: qtyEffectiveDate,
          newQuantity: qty,
          reason: qtyReason,
        }),
      });
      const data = await res.json().catch(() => null);
      if ((res.status === 200 || res.status === 201) && data?.success) {
        setActionSuccess(
          `Daily allocation change to ${qty} L from ${qtyEffectiveDate} submitted for estate approval.`
        );
        setTimeout(() => {
          handleClose();
          onRefresh();
        }, 1200);
      } else {
        setActionError(data?.error || `Failed to submit allocation change (${res.status}).`);
      }
    } catch {
      setActionError('Connection error. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Concierge Action Header */}
      <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Private Client Concierge</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Concierge Requests &amp; Schedule Adjustments
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Directly adjust your estate fulfillment schedule with guaranteed cold-chain confirmation.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSheet('pause')}
              leftIcon={<Calendar className="w-3.5 h-3.5 text-amber-600" />}
            >
              Pause for Travel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveSheet('extra')}
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
            >
              Request Extra Reserve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSheet('qty')}
              leftIcon={<TrendingUp className="w-3.5 h-3.5 text-blue-600" />}
            >
              Adjust Daily Qty
            </Button>
          </div>
        </div>

        {/* Requests Activity Log */}
        <div className="pt-6 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Active &amp; Recent Requests
          </h3>

          {pauseRequests.length === 0 && milkRequests.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              No active concierge requests. Your single-estate allocation is delivering on standard daily schedule.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {pauseRequests.map((p) => (
                <div key={p.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        Travel Hold: {p.startDate} → {p.endDate}
                      </div>
                      <div className="text-[11px] text-slate-500">{p.reason || 'Travel'}</div>
                    </div>
                  </div>
                  <Badge variant={p.status === 'APPROVED' ? 'emerald' : p.status === 'REJECTED' ? 'danger' : 'warning'}>
                    {p.status}
                  </Badge>
                </div>
              ))}

              {milkRequests.map((m) => (
                <div key={m.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        Extra Allocation: +{m.requestedQuantity} L on {m.date}
                      </div>
                      <div className="text-[11px] text-slate-500">{m.reason || 'Event'}</div>
                    </div>
                  </div>
                  <Badge variant={m.status === 'APPROVED' ? 'emerald' : m.status === 'REJECTED' ? 'danger' : 'warning'}>
                    {m.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sheet 1: Vacation / Pause */}
      <Sheet
        isOpen={activeSheet === 'pause'}
        onClose={handleClose}
        title="Schedule Travel Hold"
        description="Temporarily pause delivery while traveling. Your monthly statement will automatically reflect zero billing for pause dates."
      >
        <form onSubmit={handleCreatePause} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          {actionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Departure Date"
              type="date"
              required
              value={pauseStartDate}
              onChange={(e) => setPauseStartDate(e.target.value)}
            />
            <Input
              label="Return Date"
              type="date"
              required
              value={pauseEndDate}
              onChange={(e) => setPauseEndDate(e.target.value)}
            />
          </div>

          <Input
            label="Notes for Delivery Concierge"
            type="text"
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            placeholder="e.g. Traveling abroad / vacation"
          />

          <div className="pt-2 flex items-center gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="flex-1"
              rightIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirm Hold
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Sheet 2: Extra Milk */}
      <Sheet
        isOpen={activeSheet === 'extra'}
        onClose={handleClose}
        title="Request Extra Estate Milk"
        description="Order additional morning or evening bottles for entertaining guests or special occasions."
      >
        <form onSubmit={handleCreateExtra} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          {actionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          <Input
            label="Delivery Date"
            type="date"
            required
            value={extraDate}
            onChange={(e) => setExtraDate(e.target.value)}
          />

          <Input
            label="Additional Quantity (Litres)"
            type="number"
            step="0.5"
            min="0.5"
            max="20"
            required
            value={extraQty}
            onChange={(e) => setExtraQty(e.target.value)}
          />

          <Input
            label="Occasion / Notes"
            type="text"
            value={extraReason}
            onChange={(e) => setExtraReason(e.target.value)}
            placeholder="e.g. Dinner party guests"
          />

          <div className="pt-2 flex items-center gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="flex-1"
              rightIcon={<Sparkles className="w-4 h-4" />}
            >
              Request Allocation
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Sheet 3: Daily Quantity / Allocation Tier */}
      <Sheet
        isOpen={activeSheet === 'qty'}
        onClose={handleClose}
        title="Adjust Daily Allocation Tier"
        description="Modify your ongoing daily bottle quota. Changes apply from the effective date after estate approval."
      >
        <form onSubmit={handleCreateQtyChange} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          {actionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          <Input
            label="Effective From Date"
            type="date"
            required
            value={qtyEffectiveDate}
            onChange={(e) => setQtyEffectiveDate(e.target.value)}
          />

          <Input
            label="New Daily Quantity (Litres)"
            type="number"
            step="0.5"
            min="0.5"
            max="50"
            required
            value={qtyNewQuantity}
            onChange={(e) => setQtyNewQuantity(e.target.value)}
          />

          <Input
            label="Reason for Change"
            type="text"
            value={qtyReason}
            onChange={(e) => setQtyReason(e.target.value)}
            placeholder="e.g. Family visiting, increased need"
          />

          <div className="pt-2 flex items-center gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="flex-1"
              rightIcon={<TrendingUp className="w-4 h-4" />}
            >
              Submit Change
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}

export default MemberConcierge;
