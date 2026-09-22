'use client';

import React from 'react';
import Link from 'next/link';
import { RefreshCw, LogOut, User } from 'lucide-react';
import type { AdminOperationalStats } from '@/lib/types';

interface AdminMetricsHeaderProps {
  selectedDate: string;
  stats: AdminOperationalStats;
  monthToDate: { deliveredLitres: number; revenue: number } | null;
  onRefresh: () => void;
  onLogout: () => void;
}

/** Operational metrics header — extracted from AdminPage for maintainability. */
export function AdminMetricsHeader({ selectedDate, stats, monthToDate, onRefresh, onLogout }: AdminMetricsHeaderProps) {
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  return (
    <div className="bg-white text-slate-900 p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-700 font-bold">
              Operational Control Room • Real-Time Database State
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <span>MilkFlow Dairy Operations</span>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
              {isToday ? `Today (${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})` : selectedDate}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/profile"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition border border-slate-200 cursor-pointer"
            title="Admin & Farmer Profile"
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </Link>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition border border-slate-200 cursor-pointer"
            title="Refresh from Database"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync DB</span>
          </button>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition border border-rose-200 cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total Customers</span>
          <div className="text-xl font-black font-mono mt-1 text-slate-900">{stats.totalCustomers}</div>
          <span className="text-[10px] text-emerald-600 mt-0.5 block font-semibold">Active Daily Subscribers</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-500">Expected Milk</span>
          <div className="text-xl font-black font-mono mt-1 text-slate-900">
            {stats.expectedLitres} <span className="text-xs font-normal text-slate-500">L</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Scheduled Demand</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
          <span className="text-[10px] uppercase font-bold text-emerald-800">Delivered Milk</span>
          <div className="text-xl font-black font-mono mt-1 text-emerald-700">
            {stats.deliveredLitres} <span className="text-xs font-normal text-emerald-600">L</span>
          </div>
          <span className="text-[10px] text-emerald-700 mt-0.5 block">Actual Dropped</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-500">Billable Milk</span>
          <div className="text-xl font-black font-mono mt-1 text-slate-900">
            {stats.billableLitres} <span className="text-xs font-normal text-slate-500">L</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Server Calculated</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-500">Today Revenue</span>
          <div className="text-xl font-black font-mono mt-1 text-slate-900">₹{stats.todayRevenue}</div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Delivered Worth</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-500">Today Collected</span>
          <div className="text-xl font-black font-mono mt-1 text-emerald-700">₹{stats.todayCollected}</div>
          <span className="text-[10px] text-emerald-600 mt-0.5 block font-semibold">Payments Logged</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3 font-semibold text-slate-700">
          <span className="text-slate-500">Product Consumption:</span>
          <span className="text-emerald-700">Cow: <strong>{stats.productBreakdown.cow} L</strong></span>
          <span>•</span>
          <span className="text-blue-700">Buffalo: <strong>{stats.productBreakdown.buffalo} L</strong></span>
          <span>•</span>
          <span className="text-purple-700">Desi A2: <strong>{stats.productBreakdown.a2} L</strong></span>
        </div>

        {monthToDate && (
          <div className="text-slate-500 text-[11px] font-mono">
            Sep MTD Total: <strong className="text-slate-900">{monthToDate.deliveredLitres} L</strong> | Revenue:{' '}
            <strong className="text-emerald-700 font-bold">₹{monthToDate.revenue}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminMetricsHeader;
