'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CustomerPortal from '@/components/customer/CustomerPortal';
import { Droplets, LogOut, ShieldCheck } from 'lucide-react';
import { CustomerProfile } from '@/lib/types';
import { LanguageToggle } from '@/lib/i18n';

export default function CustomerRoutePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setPageError(null);
      // 1. Fetch current session
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.authenticated) {
        router.push('/login?redirect=/customer');
        return;
      }
      setCurrentUser(meData.user);

      // 2. Fetch client records
      const custRes = await fetch('/api/customers');
      const custData = await custRes.json();
      if (custData.success) {
        setCustomers(custData.customers);
      }
    } catch (err) {
      console.error('Failed to load client portal', err);
      setPageError('Failed to load client records. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FBFBFC] dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300">
        <div className="w-12 h-12 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-md mb-3">
          <Droplets className="w-6 h-6" />
        </div>
        <h2 className="text-base font-black text-slate-900 dark:text-white">MilkFlow Private Reserve</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Authenticating Private Client Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Client Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 dark:bg-slate-900 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xs">
              <Droplets className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Milk<span className="text-emerald-700 dark:text-emerald-500">Flow</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                  Client Reserve
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Single-Estate Client Allocation</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle compact />

            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-400">Client:</span>
              <span className="font-bold text-slate-900 dark:text-white">{currentUser?.name}</span>
            </div>

            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Client Workspace */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {pageError && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800" role="alert">
            <span className="font-bold">Notice: </span>{pageError}
          </div>
        )}
        {customers.length === 0 ? (
          <div className="bg-white dark:bg-slate-950 rounded-3xl p-10 text-center border border-slate-200/80 dark:border-slate-800 shadow-xs max-w-md mx-auto my-12 space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-slate-900 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Allocation Profile Being Configured
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your private estate allocation is being provisioned by the farm master. Your single-estate records and statements will appear here upon finalization.
            </p>
            <button
              type="button"
              onClick={loadData}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              Refresh Status
            </button>
          </div>
        ) : (
          <CustomerPortal
            currentUserId={currentUser?.userId || customers[0]?.userId}
            customers={customers}
            onRefreshAll={loadData}
          />
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-5 px-4 sm:px-6 text-xs text-slate-500 mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">MilkFlow Private Reserve</span>
            <span>•</span>
            <span>Single-Estate Client Distribution Concierge</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Active Session:</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
              {currentUser?.email || currentUser?.phone || 'Authenticated Client'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
