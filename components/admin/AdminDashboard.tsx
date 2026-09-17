'use client';

import React from 'react';
import {
  ShieldCheck,
  Building,
  Users,
  Droplets,
  DollarSign,
  AlertTriangle,
  Server,
  Activity,
} from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-100 border border-purple-200 px-2.5 py-0.5 rounded-full">
            Platform Master Console
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 tracking-tight">
            MilkFlow Commercial Dairy Administration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            SaaS multi-tenant control plane for dairy farms, cooperative federations, and customer ledgers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-700">Cluster Status: Healthy</span>
        </div>
      </div>

      {/* Global Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Connected Farms
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">12 Dairies</div>
          <div className="text-xs text-emerald-600 mt-0.5">All operating active routes</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Active Subscribed Homes
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">1,480 Families</div>
          <div className="text-xs text-slate-500 mt-0.5">Automated morning ledgers</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Daily Milk Throughput
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">2,143 Litres</div>
          <div className="text-xs text-emerald-600 mt-0.5">Today's recorded delivery</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Monthly GMV
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">₹1,07,150</div>
          <div className="text-xs text-slate-500 mt-0.5">92% online collection rate</div>
        </div>
      </div>

      {/* Registered Dairy Farms Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900">Registered Dairy Tenants</h3>
        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-3.5 flex justify-between items-center">
            <div>
              <div className="font-bold text-slate-900 text-sm">GreenValley Dairy Farm (Active Demo)</div>
              <div className="text-slate-500 text-[11px]">
                Owner: Suresh Patel • Anand, Gujarat • UPI: greenvalley@okaxis
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              OPERATIONAL
            </span>
          </div>

          <div className="py-3.5 flex justify-between items-center opacity-70">
            <div>
              <div className="font-bold text-slate-900 text-sm">Shree Krishna Desi Gir Gaushala</div>
              <div className="text-slate-500 text-[11px]">
                Owner: Vikram Desai • Nadiad, Gujarat • UPI: krishnagir@icici
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
              STANDBY
            </span>
          </div>

          <div className="py-3.5 flex justify-between items-center opacity-70">
            <div>
              <div className="font-bold text-slate-900 text-sm">Amul District Village Chilling Centre</div>
              <div className="text-slate-500 text-[11px]">
                Federation Unit #4 • Borsad, Gujarat • Member Portal
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
              STANDBY
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
