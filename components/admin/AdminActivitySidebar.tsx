'use client';

import React from 'react';
import { Clock, Calendar, FileText, Sparkles, Truck } from 'lucide-react';
import type { ActivityEvent } from '@/lib/types';

interface AdminActivitySidebarProps {
  activities: ActivityEvent[];
  onNavigateTab: (tab: string) => void;
}

/** Live activity stream + farmer quick actions — extracted from AdminPage. */
export function AdminActivitySidebar({ activities, onNavigateTab }: AdminActivitySidebarProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Live Activity Stream</h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200/60">
            Real-Time
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-150 overflow-y-auto space-y-1">
          {activities.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No recent activities</p>
          ) : (
            activities.map((act) => (
              <div key={act.id} className="pt-2.5 pb-2 text-xs">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-extrabold text-slate-900 text-[11px]">{act.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">{act.description}</p>
                <div className="text-[10px] text-slate-400 mt-0.5">By {act.actorName}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white text-slate-900 p-4.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700">Farmer Quick Actions</h4>
          </div>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            Shortcuts
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          <button
            onClick={() => onNavigateTab('daily')}
            className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <Truck className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 text-xs truncate">Daily Delivery Run</div>
                <div className="text-[10px] text-slate-500 truncate">Delivery checklist &amp; mark drops</div>
              </div>
            </div>
            <kbd className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-2">⌥1</kbd>
          </button>

          <button
            onClick={() => onNavigateTab('calendar')}
            className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 text-xs truncate">Delivery Calendar</div>
                <div className="text-[10px] text-slate-500 truncate">Who receives what quantity</div>
              </div>
            </div>
            <kbd className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-2">⌥2</kbd>
          </button>

          <button
            onClick={() => onNavigateTab('billing')}
            className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 text-xs truncate">Monthly Invoices</div>
                <div className="text-[10px] text-slate-500 truncate">Automated billing ledger</div>
              </div>
            </div>
            <kbd className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-2">⌥3</kbd>
          </button>

          <button
            onClick={() => onNavigateTab('audit')}
            className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 text-xs truncate">Cryptographic Audit</div>
                <div className="text-[10px] text-slate-500 truncate">SHA-256 tamper-proof log</div>
              </div>
            </div>
            <kbd className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-2">⌥4</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminActivitySidebar;
