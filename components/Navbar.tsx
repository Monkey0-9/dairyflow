'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Bell,
  AlertTriangle,
  UserCheck,
  ChevronDown,
  Droplets,
  Truck,
  FileText,
  CreditCard,
  Sparkles,
  ShieldCheck,
  Navigation,
  Clock,
} from 'lucide-react';
import { UserRole, Notification } from '@/lib/types';

interface NavbarProps {
  currentRole: UserRole;
  currentUserId: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onPersonaChange: (role: UserRole, userId: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  notifications: Notification[];
  onMarkNotificationRead: (id: string) => void;
  disputeCount: number;
  pendingRequestsCount?: number;
}

export const personas = [
  {
    role: 'FARMER' as UserRole,
    userId: 'user_farmer',
    name: 'Suresh Patel (Farmer)',
    subtitle: 'GreenValley Dairy Farm',
    badge: 'Admin / Seller',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    role: 'CUSTOMER' as UserRole,
    userId: 'user_ravi',
    name: 'Ravi Kumar',
    subtitle: 'Cow Milk 1.0 L • Route #1',
    badge: 'Customer',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    role: 'CUSTOMER' as UserRole,
    userId: 'user_priya',
    name: 'Priya Sharma',
    subtitle: 'Buffalo Milk 1.5 L (Vacation Sep 20-25)',
    badge: 'Customer (Vacation)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    role: 'CUSTOMER' as UserRole,
    userId: 'user_anand',
    name: 'Anand Verma',
    subtitle: 'A2 Milk 2.0 L (Open Dispute)',
    badge: 'Customer (Dispute)',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    role: 'ADMIN' as UserRole,
    userId: 'user_admin',
    name: 'Platform SuperAdmin',
    subtitle: 'Global System Oversight',
    badge: 'System Admin',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
];

export default function Navbar({
  currentRole,
  currentUserId,
  selectedDate,
  onDateChange,
  onPersonaChange,
  activeTab,
  onTabChange,
  notifications,
  onMarkNotificationRead,
  disputeCount,
  pendingRequestsCount,
}: NavbarProps) {
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  const activePersona = personas.find((p) => p.userId === currentUserId) || personas[0];
  const unreadNotifs = notifications.filter((n) => !n.read);

  const isToday = selectedDate === '2026-09-16';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
      {/* Top Banner with Persona Switcher & App Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Droplets className="w-6 h-6 animate-pulse-subtle" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-slate-900">
                  Milk<span className="text-emerald-600">Flow</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 tracking-wide uppercase">
                  Digital Dairy Ledger
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Subscription & Delivery Management Platform
              </p>
            </div>
          </div>

          {/* Center Date Controller (For Farmer & Admin) */}
          {currentRole !== 'CUSTOMER' && (
            <div className="hidden md:flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => onDateChange('2026-09-16')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isToday
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today (16 Sep)
              </button>
              <button
                onClick={() => onDateChange('2026-09-15')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedDate === '2026-09-15'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yesterday
              </button>
              <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Right Actions: Persona Switcher + Notifications */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDrawer(!showNotifDrawer)}
                className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {/* Notification Slideout / Dropdown */}
              {showNotifDrawer && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">Notifications</span>
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                        {unreadNotifs.length} unread
                      </span>
                    </div>
                    <button
                      onClick={() => onMarkNotificationRead('ALL')}
                      className="text-xs text-emerald-600 hover:underline font-medium"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">No notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => onMarkNotificationRead(n.id)}
                          className={`p-3 text-left hover:bg-slate-50 transition cursor-pointer ${
                            !n.read ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-semibold text-slate-900">{n.title}</h4>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Persona Switcher Pill */}
            <div className="relative">
              <button
                onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  {activePersona.name.charAt(0)}
                </div>
                <div className="hidden sm:block leading-tight">
                  <div className="text-xs font-bold text-slate-900">{activePersona.name}</div>
                  <div className="text-[10px] text-slate-500">{activePersona.subtitle}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Persona Switcher Dropdown */}
              {showPersonaMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50">
                  <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Switch Test Persona
                  </div>
                  <div className="space-y-1">
                    {personas.map((p) => {
                      const isSelected = p.userId === currentUserId;
                      return (
                        <button
                          key={p.userId}
                          onClick={() => {
                            onPersonaChange(p.role, p.userId);
                            setShowPersonaMenu(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-950 font-semibold border border-emerald-200'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold">{p.name}</div>
                            <div className="text-[11px] text-slate-500">{p.subtitle}</div>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${p.badgeColor}`}
                          >
                            {p.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Nav Bar for Farmer / Customer */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto py-2 gap-2 text-xs font-medium scrollbar-none">
          {currentRole === 'FARMER' ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onTabChange('daily')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'daily'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Daily Delivery</span>
              </button>

              <button
                onClick={() => onTabChange('calendar')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'calendar'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Monthly Calendar</span>
              </button>

              <button
                onClick={() => onTabChange('customers')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'customers'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Customers & Subs</span>
              </button>

              <button
                onClick={() => onTabChange('billing')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'billing'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Monthly Billing</span>
              </button>

              <button
                onClick={() => onTabChange('disputes')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition relative ${
                  activeTab === 'disputes'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Disputes</span>
                {disputeCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                    {disputeCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onTabChange('requests')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition relative ${
                  activeTab === 'requests'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Requests</span>
                {pendingRequestsCount !== undefined && pendingRequestsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onTabChange('pricing')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'pricing'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>Products & Rates</span>
              </button>

              <button
                onClick={() => onTabChange('forecast')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'forecast'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Demand Forecast</span>
              </button>

              <button
                onClick={() => onTabChange('audit')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'audit'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Audit Trail</span>
              </button>

              <button
                onClick={() => onTabChange('routes')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'routes'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Delivery Routes</span>
              </button>
            </div>
          ) : currentRole === 'CUSTOMER' ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onTabChange('customer_home')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'customer_home'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>My Milk Dashboard</span>
              </button>

              <button
                onClick={() => onTabChange('customer_calendar')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'customer_calendar'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Monthly Consumption</span>
              </button>

              <button
                onClick={() => onTabChange('customer_billing')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'customer_billing'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Invoices & Pay</span>
              </button>

              <button
                onClick={() => onTabChange('customer_vacation')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'customer_vacation'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Pause / Vacation</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="px-3 py-1 text-slate-500 font-medium">
                Admin Control Room • GreenValley Dairy Platform
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
