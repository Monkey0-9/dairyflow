'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { listQueuedPaymentIntents, listQueuedMutations, syncWhenOnline, QueuedPaymentIntent, QueuedDeliveryMutation } from '@/lib/offline-sync';

export default function OfflinePage() {
  const [queuedPayments, setQueuedPayments] = useState<QueuedPaymentIntent[]>([]);
  const [queuedDeliveries, setQueuedDeliveries] = useState<QueuedDeliveryMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : false);

  const loadQueue = useCallback(async () => {
    try {
      const [payments, deliveries] = await Promise.all([
        listQueuedPaymentIntents(),
        listQueuedMutations(),
      ]);
      setQueuedPayments(payments);
      setQueuedDeliveries(deliveries);
    } catch {
      // IndexedDB might not be available
    }
  }, []);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncWhenOnline();
      await loadQueue();
    } finally {
      setIsSyncing(false);
    }
  }, [loadQueue]);

  useEffect(() => {
    void loadQueue();

    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        void handleSync();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [loadQueue, handleSync]);

  const totalQueued = queuedPayments.length + queuedDeliveries.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
            <WifiOff className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Private Reserve Ledger — Offline</h1>
          <p className="text-sm text-slate-400 mt-2">
            Network connection unavailable. Your transactions and preferences are securely encrypted and queued locally.
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Local SHA-256 Queue Protected</span>
          </div>
        </div>

        {totalQueued > 0 ? (
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Pending Local Synclist</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {totalQueued} Queued
              </span>
            </div>

            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              {queuedPayments.map((p) => (
                <div key={p.id} className="p-3.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <p className="font-medium text-white">Payment Intent</p>
                      <p className="text-xs text-slate-400">₹{p.amount.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">Pending Online</span>
                </div>
              ))}

              {queuedDeliveries.map((d, idx) => (
                <div key={d.queueId || idx} className="p-3.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-medium text-white">Delivery Record Mutation</p>
                      <p className="text-xs text-slate-400">{d.status || 'Updated'}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">Pending Ledger</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center mb-8">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-xs text-slate-400">All local mutations are fully synchronized with the cloud ledger.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => void handleSync()}
            disabled={isSyncing}
            className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing Ledger...' : isOnline ? 'Sync Now' : 'Check & Reconnect'}</span>
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Reload Client Portal
          </button>
        </div>
      </div>
    </div>
  );
}
