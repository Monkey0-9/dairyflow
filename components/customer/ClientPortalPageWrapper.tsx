'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CustomerPortal from '@/components/customer/CustomerPortal';
import { Droplets } from 'lucide-react';
import { CustomerProfile } from '@/lib/types';
import Link from 'next/link';

interface ClientPortalPageWrapperProps {
  initialTab: 'HOME' | 'STATEMENTS' | 'CONCIERGE' | 'QR' | 'PROFILE';
}

export default function ClientPortalPageWrapper({ initialTab }: ClientPortalPageWrapperProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ id?: string; userId?: string; role?: string } | null>(null);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
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
      }
    } catch (err) {
      console.error('Failed to load client data', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-md mb-3">
          <Droplets className="w-6 h-6 animate-pulse" />
        </div>
        <h2 className="text-base font-black text-white">MilkFlow Private Reserve</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Authenticating Private Client Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0B0F17]">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Droplets className="w-4 h-4" />
            </div>
            <span className="text-sm font-black text-slate-950 dark:text-white tracking-tight">
              Milk<span className="text-amber-500">Flow</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Private Reserve
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/customer/home"
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                initialTab === 'HOME'
                  ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Home
            </Link>
            <Link
              href="/customer/statements"
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                initialTab === 'STATEMENTS'
                  ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Statements
            </Link>
            <Link
              href="/customer/requests"
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                initialTab === 'CONCIERGE'
                  ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Concierge
            </Link>
            <Link
              href="/customer/qr"
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                initialTab === 'QR'
                  ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Access QR
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <CustomerPortal
          currentUserId={currentUser?.userId || currentUser?.id || 'cust_1'}
          customers={customers}
          onRefreshAll={() => void loadData()}
          initialTab={initialTab}
        />
      </main>
    </div>
  );
}
