'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CustomerPortal from '@/components/customer/CustomerPortal';
import { Droplets } from 'lucide-react';
import { CustomerProfile } from '@/lib/types';
import Link from 'next/link';

interface ClientPortalPageWrapperProps {
  initialTab: 'HOME' | 'STATEMENTS' | 'CONCIERGE' | 'PAYMENT' | 'QR' | 'PROFILE';
}

export default function ClientPortalPageWrapper({ initialTab }: ClientPortalPageWrapperProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ id?: string; userId?: string; role?: string } | null>(null);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.authenticated) {
        router.push('/login?redirect=/customer');
        return;
      }
      setCurrentUser(meData.user);

      const custRes = await fetch('/api/customers');
      const custData = await custRes.json();
      if (custData.success) {
        setCustomers(custData.customers);
      } else {
        setLoadError(custData.error || 'Failed to load client records.');
      }
    } catch (err) {
      console.error('Failed to load client data', err);
      setLoadError('Failed to load client records. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Session-derived identity only — never fall back to a hardcoded demo id.
  // An empty id renders the "provisioning" empty state instead of leaking
  // another client's allocation.
  const resolvedUserId = currentUser?.userId || currentUser?.id || '';

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-slate-700">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-md mb-3">
          <Droplets className="w-6 h-6 animate-pulse" />
        </div>
        <h2 className="text-base font-black text-slate-900">MilkFlow Private Reserve</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Authenticating Private Client Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFC]">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Droplets className="w-4 h-4" />
            </div>
            <span className="text-sm font-black text-slate-950 tracking-tight">
              Milk<span className="text-amber-500">Flow</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              Private Reserve
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/customer/home"
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                initialTab === 'HOME'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Home
            </Link>
            <Link
              href="/customer/statements"
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                initialTab === 'STATEMENTS'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Statements
            </Link>
            <Link
              href="/customer/requests"
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                initialTab === 'CONCIERGE'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Concierge
            </Link>
            <Link
              href="/customer/payment"
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                initialTab === 'PAYMENT'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pay via UPI
            </Link>
            <Link
              href="/customer/qr"
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                initialTab === 'QR'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              QR Token
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loadError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800" role="alert">
            <span className="font-bold">Couldn&apos;t load your allocation: </span>{loadError}
          </div>
        )}
        {!resolvedUserId ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-md mx-auto my-12 space-y-3">
            <h3 className="text-base font-bold text-slate-900">Allocation Profile Being Configured</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your private estate allocation is being provisioned by the farm administrator.
              Your records will appear here as soon as allocation completes.
            </p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Refresh Status
            </button>
          </div>
        ) : (
          <CustomerPortal
            currentUserId={resolvedUserId}
            customers={customers}
            onRefreshAll={() => void loadData()}
            initialTab={initialTab}
          />
        )}
      </main>
    </div>
  );
}
