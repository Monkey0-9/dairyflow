'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CustomerPortal from '@/components/customer/CustomerPortal';
import { Droplets, LogOut, ShieldCheck, UserCheck, RefreshCw } from 'lucide-react';
import { CustomerProfile } from '@/lib/types';
import Link from 'next/link';

export default function CustomerRoutePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch current session
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.authenticated) {
        router.push('/login?redirect=/customer');
        return;
      }
      setCurrentUser(meData.user);

      // 2. Fetch customer records
      const custRes = await fetch('/api/customers');
      const custData = await custRes.json();
      if (custData.success) {
        setCustomers(custData.customers);
      }
    } catch (err) {
      console.error('Failed to load customer portal', err);
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

  const handleSwitchCustomerPersona = async (demoUserId: string) => {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoUserId }),
    });
    loadData();
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/20 mb-3">
          <Droplets className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-slate-900">MilkFlow Customer Portal</h2>
        <p className="text-xs text-slate-500 mt-1">Connecting to your dairy subscription...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col">
      {/* Top Customer Header with Safe Customer Switcher & Logout */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                Milk<span className="text-emerald-600">Flow</span>
              </span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                Customer Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Customer Switcher for Demo Evaluation */}
            <div className="hidden sm:flex items-center gap-1 text-xs bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold px-2 uppercase">Switch Client:</span>
              <button
                onClick={() => handleSwitchCustomerPersona('user_ravi')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  currentUser?.userId === 'user_ravi'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ravi (Active)
              </button>
              <button
                onClick={() => handleSwitchCustomerPersona('user_priya')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  currentUser?.userId === 'user_priya'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Priya (Vacation)
              </button>
              <button
                onClick={() => handleSwitchCustomerPersona('user_anand')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  currentUser?.userId === 'user_anand'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Anand (Dispute)
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Customer Portal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <CustomerPortal
          currentUserId={currentUser?.userId || 'user_ravi'}
          customers={customers}
          onRefreshAll={loadData}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">MilkFlow Customer Portal</span>
            <span>•</span>
            <span>GreenValley Dairy Farm Client Service</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Signed in as:</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {currentUser?.name} ({currentUser?.email})
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
