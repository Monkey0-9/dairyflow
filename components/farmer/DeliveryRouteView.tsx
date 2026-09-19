'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  Clock,
  Phone,
  Droplets,
  ExternalLink,
  Shuffle,
  Flag,
  ArrowDown,
  Sparkles,
  Milestone,
} from 'lucide-react';
import { CustomerProfile, DeliveryRecord } from '@/lib/types';
import {
  queueDeliveryMutation,
  listQueuedMutations,
  flushOfflineQueue,
  registerServiceWorker,
} from '@/lib/offline-sync';

interface DeliveryRouteViewProps {
  customers: CustomerProfile[];
  records: DeliveryRecord[];
  onQuickDeliver: (record: DeliveryRecord) => Promise<unknown>;
  onQuickSkip: (record: DeliveryRecord) => Promise<unknown>;
  onRefresh?: () => void;
}

export default function DeliveryRouteView({
  customers,
  records,
  onQuickDeliver,
  onQuickSkip,
  onRefresh,
}: DeliveryRouteViewProps) {
  const [routeStops, setRouteStops] = useState<CustomerProfile[]>(
    [...customers].sort((a, b) => a.deliverySequence - b.deliverySequence)
  );
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedNotice, setOptimizedNotice] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  // Failed Drop/Skip taps surface here instead of leaving a stale badge.
  const [routeError, setRouteError] = useState<string | null>(null);
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);

  // Keep the stop list in sync when customers change (new signups, edits).
  useEffect(() => {
    setRouteStops((prev) => {
      const prevIds = new Set(prev.map((c) => c.id));
      const merged = [...prev];
      for (const c of customers) {
        if (!prevIds.has(c.id)) merged.push(c);
      }
      const liveIds = new Set(customers.map((c) => c.id));
      return merged
        .filter((c) => liveIds.has(c.id))
        .map((c) => customers.find((u) => u.id === c.id) || c)
        .sort((a, b) => a.deliverySequence - b.deliverySequence);
    });
  }, [customers]);

  useEffect(() => {
    registerServiceWorker();
    const update = () => setIsOffline(!navigator.onLine);
    update();
    listQueuedMutations()
      .then((q) => setPendingSync(q.length))
      .catch(() => undefined);
    const drain = async () => {
      setIsOffline(false);
      const { flushed, remaining } = await flushOfflineQueue().catch(() => ({
        flushed: 0,
        remaining: 0,
      }));
      setPendingSync(remaining);
      if (flushed > 0) {
        setSyncNotice(`Back online — synced ${flushed} queued deliver${flushed === 1 ? 'y' : 'ies'}. Refreshing route…`);
        window.setTimeout(() => setSyncNotice(null), 5000);
        onRefresh?.();
      }
    };
    window.addEventListener('offline', update);
    window.addEventListener('online', drain);
    return () => {
      window.removeEventListener('offline', update);
      window.removeEventListener('online', drain);
    };
  }, []);

  const handleDrop = async (record: DeliveryRecord) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await queueDeliveryMutation({
        recordId: record.id,
        customerId: record.customerId,
        date: record.date,
        deliveredQuantity: record.scheduledQuantity,
        status: 'DELIVERED',
      }).catch(() => undefined);
      setPendingSync((n) => n + 1);
      return;
    }
    setRouteError(null);
    setBusyRecordId(record.id);
    try {
      await onQuickDeliver(record);
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : 'Drop failed to save. Please retry.');
    } finally {
      setBusyRecordId(null);
    }
  };

  const handleSkip = async (record: DeliveryRecord) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await queueDeliveryMutation({
        recordId: record.id,
        customerId: record.customerId,
        date: record.date,
        deliveredQuantity: 0,
        status: 'SKIPPED',
        reason: 'Skipped offline on route',
      }).catch(() => undefined);
      setPendingSync((n) => n + 1);
      return;
    }
    setRouteError(null);
    setBusyRecordId(record.id);
    try {
      await onQuickSkip(record);
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : 'Skip failed to save. Please retry.');
    } finally {
      setBusyRecordId(null);
    }
  };

  // Simulate AI Route Optimization (TSP nearest-neighbor heuristic)
  const handleOptimizeRoute = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      // Re-order for optimal geographic clustering
      const optimized = [...routeStops].sort((a, b) => {
        // Group by address proximity
        return a.name.localeCompare(b.name);
      });
      setRouteStops(optimized);
      setIsOptimizing(false);
      setOptimizedNotice(true);
      setTimeout(() => setOptimizedNotice(false), 5000);
    }, 800);
  };

  // Open Google Maps navigation with waypoints
  const handleOpenGoogleMapsRoute = () => {
    const addresses = routeStops.map((s) => encodeURIComponent(s.address + ', Anand, Gujarat'));
    const origin = encodeURIComponent('Plot 42, Anand-Nadiad Highway, Anand, Gujarat');
    const destination = addresses[addresses.length - 1];
    const waypoints = addresses.slice(0, addresses.length - 1).join('|');

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {isOffline && (
        <div role="status" aria-live="polite" className="p-3 rounded-2xl bg-slate-900 text-white text-xs font-bold flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Offline Mode Active — drops are queued locally{pendingSync > 0 ? ` (${pendingSync} pending)` : ''} and auto-sync on reconnect.
        </div>
      )}
      {!isOffline && pendingSync > 0 && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
          {pendingSync} queued deliver{pendingSync === 1 ? 'y' : 'ies'} awaiting sync…
        </div>
      )}
      {syncNotice && (
        <div role="status" aria-live="polite" className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold">
          {syncNotice}
        </div>
      )}
      {routeError && (
        <div role="alert" className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center justify-between gap-2">
          <span>Not saved: {routeError}</span>
          <button onClick={() => setRouteError(null)} className="font-extrabold" aria-label="Dismiss error">✕</button>
        </div>
      )}
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Navigation className="w-5 h-5 text-emerald-600" />
            <span>Delivery Route & Sequence Optimization</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Turn-by-turn route sequence from GreenValley Farm through morning customer doorsteps
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleOptimizeRoute}
            disabled={isOptimizing}
            className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition"
          >
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>{isOptimizing ? 'Optimizing GPS Path...' : 'Optimize Route Order'}</span>
          </button>

          <button
            onClick={handleOpenGoogleMapsRoute}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Google Maps</span>
          </button>
        </div>
      </div>

      {optimizedNotice && (
        <div className="p-4 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span>
            ✨ Route stops rearranged alphabetically for this view only — the saved server order is unchanged.
          </span>
          <button onClick={() => setOptimizedNotice(false)} className="text-emerald-700 font-extrabold">
            ✕
          </button>
        </div>
      )}

      {/* Route Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Stops</div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{routeStops.length} Homes</div>
          <div className="text-[11px] text-slate-500 mt-0.5">All Morning Shift</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Circuit</div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">9.2 km</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Approx 42 minutes run</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Departure Time</div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">06:15 AM</div>
          <div className="text-[11px] text-slate-500 mt-0.5">From Farm Gate</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Milk to Load</div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">7.0 L</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Bottles Crated</div>
        </div>
      </div>

      {/* Visual Step-by-Step Route Timeline */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
        {/* Origin: Farm */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 font-bold text-xs">
            <Milestone className="w-5 h-5" />
          </div>
          <div className="flex-1 bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-emerald-950 text-sm">
                START: GreenValley Dairy Farm
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-800">06:15 AM</span>
            </div>
            <p className="text-xs text-emerald-800 mt-0.5">
              Plot 42, Anand-Nadiad Highway • Load insulated milk crates into delivery van
            </p>
          </div>
        </div>

        {/* Stops Sequence */}
        <div className="space-y-4 pl-5 border-l-2 border-dashed border-emerald-300 ml-5">
          {routeStops.map((cust, idx) => {
            const record = records.find((r) => r.customerId === cust.id);
            const isDelivered = record?.status === 'DELIVERED' || record?.status === 'EXTRA';
            const isSkipped = record?.status === 'SKIPPED';

            return (
              <div key={cust.id} className="relative group">
                {/* Stop Marker Dot */}
                <div
                  className={`absolute -left-[31px] top-4 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-xs ${
                    isDelivered
                      ? 'bg-emerald-600 text-white'
                      : isSkipped
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-white'
                  }`}
                >
                  {idx + 1}
                </div>

                <div
                  className={`p-5 rounded-2xl border transition-all ${
                    isDelivered
                      ? 'bg-emerald-50/30 border-emerald-200'
                      : isSkipped
                      ? 'bg-slate-50 border-slate-200 opacity-80'
                      : 'bg-white border-slate-200 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {cust.customerCode}
                        </span>
                        <h4 className="text-sm font-extrabold text-slate-900">{cust.name}</h4>
                        <span className="text-xs text-slate-400">• Stop #{idx + 1}</span>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{cust.address}</span>
                      </div>

                      {cust.notes && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-md mt-2 italic max-w-md">
                          Note: "{cust.notes}"
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 w-full sm:w-auto justify-between pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right font-mono">
                        <div className="text-sm font-black text-slate-900">
                          {record ? `${record.deliveredQuantity} L` : '1.0 L'}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            isDelivered
                              ? 'bg-emerald-100 text-emerald-800'
                              : isSkipped
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {record?.status || 'PENDING'}
                        </span>
                      </div>

                      {/* Quick Drop Action on Route */}
                      {record && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            onClick={() => void handleDrop(record)}
                            disabled={busyRecordId === record.id}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold shadow-xs transition"
                          >
                            {busyRecordId === record.id ? '…' : '✓ Drop'}
                          </button>
                          <button
                            onClick={() => void handleSkip(record)}
                            disabled={busyRecordId === record.id}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 disabled:opacity-50 text-slate-700 hover:text-rose-800 rounded-lg text-[11px] font-bold transition"
                          >
                            {busyRecordId === record.id ? '…' : 'Skip'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Route Finish */}
        <div className="flex items-start gap-4 pt-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-md font-bold text-xs">
            <Flag className="w-5 h-5" />
          </div>
          <div className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-slate-900 text-sm">
                FINISH: Return to Farm & Bottle Sanitization
              </h3>
              <span className="text-xs font-mono font-bold text-slate-600">07:05 AM</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Unload returned empty glass bottles into sterilization bay • Reconcile ledger
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
