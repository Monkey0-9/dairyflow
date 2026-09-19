'use client';

import React, { useState } from 'react';
import { Check, X, QrCode, Plus, Minus, AlertCircle } from 'lucide-react';
import { DeliveryRecord } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';

export interface CustomerRowProps {
  record: DeliveryRecord;
  onUpdateDelivery: (
    recordId: string,
    status: 'DELIVERED' | 'SKIPPED' | 'PARTIAL',
    deliveredQty: number,
    bottlesReturned: number,
    notes?: string
  ) => Promise<void>;
  onShowQR?: (record: DeliveryRecord) => void;
  isSunlightMode?: boolean;
}

export function CustomerRow({
  record,
  onUpdateDelivery,
  onShowQR,
  isSunlightMode = false,
}: CustomerRowProps) {
  const [bottles, setBottles] = useState<number>(record.bottlesReturned || 0);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showPartialInput, setShowPartialInput] = useState<boolean>(false);
  const [customQty, setCustomQty] = useState<string>(
    record.deliveredQuantity > 0 ? String(record.deliveredQuantity) : String(record.scheduledQuantity)
  );

  const handleDeliver = async () => {
    setIsUpdating(true);
    try {
      await onUpdateDelivery(
        record.id,
        'DELIVERED',
        record.scheduledQuantity,
        bottles
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkip = async () => {
    setIsUpdating(true);
    try {
      await onUpdateDelivery(record.id, 'SKIPPED', 0, bottles, 'Customer absent / skipped');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCustomSubmit = async () => {
    const qty = parseFloat(customQty);
    if (isNaN(qty) || qty < 0) return;
    setIsUpdating(true);
    try {
      const status = qty === 0 ? 'SKIPPED' : qty === record.scheduledQuantity ? 'DELIVERED' : 'PARTIAL';
      await onUpdateDelivery(record.id, status, qty, bottles, `Recorded ${qty} L`);
      setShowPartialInput(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBottleChange = (delta: number) => {
    const next = Math.max(0, bottles + delta);
    setBottles(next);
  };

  const isDelivered = record.status === 'DELIVERED';
  const isSkipped = record.status === 'SKIPPED' || record.status === 'NOT_DELIVERED';
  const isPartial = record.status === 'PARTIAL';
  const isDisputed = record.status === 'DISPUTED';

  return (
    <div
      className={`p-4 rounded-2xl border transition-all ${
        isSunlightMode
          ? 'bg-white border-2 border-black text-black'
          : isDelivered
          ? 'bg-emerald-50/40 border-emerald-200'
          : isSkipped
          ? 'bg-slate-100/70 border-slate-300 opacity-80'
          : isDisputed
          ? 'bg-rose-50/60 border-rose-200'
          : 'bg-white border-slate-200/80 shadow-2xs hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Customer Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-slate-900 truncate">
              {record.customerName || 'Customer'}
            </h4>
            {onShowQR && (
              <button
                type="button"
                onClick={() => onShowQR(record)}
                className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-slate-100 transition cursor-pointer"
                title="Show Customer QR"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {record.productName || 'Milk'} •{' '}
            <span className="font-extrabold text-slate-800">{record.scheduledQuantity} L</span> scheduled
          </p>
        </div>

        {/* Status Badge */}
        <div className="shrink-0">
          {isDelivered && <Badge variant="success">Delivered ({record.deliveredQuantity}L)</Badge>}
          {isSkipped && <Badge variant="neutral">Skipped</Badge>}
          {isPartial && <Badge variant="warning">Partial ({record.deliveredQuantity}L)</Badge>}
          {isDisputed && <Badge variant="danger">Disputed</Badge>}
          {!isDelivered && !isSkipped && !isPartial && !isDisputed && (
            <Badge variant="info">Pending</Badge>
          )}
        </div>
      </div>

      {/* 1-Thumb Action Strip */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        {/* Bottles returned counter */}
        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/60">
          <span className="text-[11px] font-bold text-slate-600">Bottles:</span>
          <button
            type="button"
            onClick={() => handleBottleChange(-1)}
            disabled={bottles <= 0}
            className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 disabled:opacity-30 cursor-pointer"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs font-black text-slate-900 w-4 text-center">{bottles}</span>
          <button
            type="button"
            onClick={() => handleBottleChange(1)}
            className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Deliver & Skip Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => setShowPartialInput(!showPartialInput)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            {showPartialInput ? 'Cancel' : 'Edit Qty'}
          </button>

          <button
            type="button"
            disabled={isUpdating}
            onClick={handleSkip}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer min-h-[44px] ${
              isSkipped
                ? 'bg-slate-200 text-slate-800'
                : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>Skip</span>
          </button>

          <button
            type="button"
            disabled={isUpdating}
            onClick={handleDeliver}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[44px] ${
              isDelivered
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{isDelivered ? 'Delivered' : `Deliver ${record.scheduledQuantity}L`}</span>
          </button>
        </div>
      </div>

      {/* Partial Quantity Drawer */}
      {showPartialInput && (
        <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 animate-in fade-in">
          <label htmlFor={`partial-qty-${record.id}`} className="text-xs font-bold text-slate-700">Actual Litres:</label>
          <input
            id={`partial-qty-${record.id}`}
            type="number"
            step="0.25"
            min="0"
            value={customQty}
            onChange={(e) => setCustomQty(e.target.value)}
            className="w-20 px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white"
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={isUpdating}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Save
          </button>
        </div>
      )}

      {record.notes && (
        <div className="mt-2 text-[11px] text-slate-500 italic flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-slate-400" />
          <span>{record.notes}</span>
        </div>
      )}
    </div>
  );
}
