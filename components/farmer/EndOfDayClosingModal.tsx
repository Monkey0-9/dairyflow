'use client';

import React, { useState } from 'react';
import { Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface EndOfDayClosingModalProps {
  isOpen?: boolean;
  onClose: () => void;
  date?: string;
  selectedDate?: string;
  totalDelivered: number;
  totalExpected?: number;
  skippedCount?: number;
  onConfirmCloseDay?: (data: {
    cowMilkProduced: number;
    buffaloMilkProduced: number;
    a2MilkProduced: number;
    remainingStock: number;
    wasteOrSpillage: number;
    personalConsumption: number;
  }) => Promise<void>;
  onConfirmClose?: (data: {
    productionQuantity: number;
    deliveredQuantity: number;
    wasteQuantity: number;
    personalQuantity: number;
    variance: number;
  }) => Promise<void>;
}

export function EndOfDayClosingModal({
  isOpen = true,
  onClose,
  date,
  selectedDate,
  totalDelivered,
  totalExpected = 0,
  skippedCount = 0,
  onConfirmCloseDay,
  onConfirmClose,
}: EndOfDayClosingModalProps) {
  const effectiveDate = selectedDate || date || new Date().toISOString().split('T')[0];
  const [productionQty, setProductionQty] = useState<string>(String(totalDelivered + 2));
  const [wasteQty, setWasteQty] = useState<string>('0.5');
  const [personalQty, setPersonalQty] = useState<string>('1.5');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string>('');

  const prod = parseFloat(productionQty) || 0;
  const waste = parseFloat(wasteQty) || 0;
  const personal = parseFloat(personalQty) || 0;
  const totalAccounted = totalDelivered + waste + personal;
  const variance = parseFloat((prod - totalAccounted).toFixed(2));

  const handleFinalize = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      if (onConfirmCloseDay) {
        await onConfirmCloseDay({
          cowMilkProduced: prod,
          buffaloMilkProduced: 0,
          a2MilkProduced: 0,
          remainingStock: variance > 0 ? variance : 0,
          wasteOrSpillage: waste,
          personalConsumption: personal,
        });
      } else if (onConfirmClose) {
        await onConfirmClose({
          productionQuantity: prod,
          deliveredQuantity: totalDelivered,
          wasteQuantity: waste,
          personalQuantity: personal,
          variance,
        });
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to lock daily closing record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="End-of-Day Ledger Closing"
      description={`Balance production and finalize delivery records for ${effectiveDate}.`}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                    Delivered Today
                  </span>
                  <div className="text-2xl font-black mt-1">
                    {totalDelivered} <span className="text-sm font-bold text-emerald-700">Litres</span>
                  </div>
                </div>
                {totalExpected > 0 && (
                  <div className="text-right text-xs">
                    <div className="text-emerald-700 font-bold">Scheduled: {totalExpected}L</div>
                    {skippedCount > 0 && <div className="text-amber-700 font-semibold">{skippedCount} skipped</div>}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-emerald-800/80 mt-1">
                Calculated directly from confirmed daily customer deliveries.
              </p>
            </div>

            <Input
              label="Total Milk Milked / Produced Today (Litres)"
              type="number"
              step="0.5"
              min="0"
              value={productionQty}
              onChange={(e) => setProductionQty(e.target.value)}
              placeholder="e.g. 50"
              helperText="Enter morning + evening yield from your dairy cows/buffaloes."
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Home / Personal Use (L)"
                type="number"
                step="0.25"
                min="0"
                value={personalQty}
                onChange={(e) => setPersonalQty(e.target.value)}
                placeholder="e.g. 1.5"
              />
              <Input
                label="Spilled / Waste Milk (L)"
                type="number"
                step="0.25"
                min="0"
                value={wasteQty}
                onChange={(e) => setWasteQty(e.target.value)}
                placeholder="e.g. 0.5"
              />
            </div>

            <Button
              variant="primary"
              onClick={() => setStep(2)}
              className="w-full mt-2"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Review Reconciliation Summary
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Reconciliation Table */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Total Production:</span>
                <span>{prod} L</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Customer Delivered:</span>
                <span>- {totalDelivered} L</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Personal Consumption:</span>
                <span>- {personal} L</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Spilled / Waste:</span>
                <span>- {waste} L</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-slate-900 text-sm">
                <span>Closing Variance:</span>
                <span
                  className={
                    variance === 0
                      ? 'text-emerald-600'
                      : variance > 0
                      ? 'text-blue-600'
                      : 'text-rose-600'
                  }
                >
                  {variance > 0 ? `+${variance}` : variance} L
                </span>
              </div>
            </div>

            {/* Lock Notice */}
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Audit Lock:</strong> Finalizing this closing locks the delivery records for{' '}
                {date}. Any subsequent edits will require an authorized adjustment.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                variant="primary"
                isLoading={isSubmitting}
                onClick={handleFinalize}
                className="flex-1"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Confirm &amp; Lock Day
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default EndOfDayClosingModal;
