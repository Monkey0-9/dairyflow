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
import { useT, LanguageToggle } from '@/lib/i18n';

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
  const { t } = useT();

  const activePersona = personas.find((p) => p.userId === currentUserId) || personas[0];
  const unreadNotifs = notifications.filter((n) => !n.read);

  const todayStr = new Date().toISOString().split('T')[0];
  const yDate = new Date();
  yDate.setDate(yDate.getDate() - 1);
  const yesterdayStr = yDate.toISOString().split('T')[0];
  const isToday = selectedDate === todayStr;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-xs transition-all">
      {/* Top Banner with Persona Switcher & App Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/30 animate-pulse-subtle">
              <Droplets className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 bg-clip-text text-transparent">
                  Milk<span className="text-emerald-600">Flow</span>
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 tracking-wide uppercase shadow-2xs">
                  {t('brand.tag')}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
                <span>{t('brand.sub')}</span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50/80 px-1.5 py-0.2 rounded-md border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Neon DB Live
                </span>
              </div>
            </div>
          </div>

          {/* Center Date Controller (For Farmer & Admin) */}
          {currentRole !== 'CUSTOMER' && (
            <div className="hidden md:flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-2xs">
              <button
                onClick={() => onDateChange(todayStr)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  isToday
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {t('nav.today')}
              </button>
              <button
                onClick={() => onDateChange(yesterdayStr)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  selectedDate === yesterdayStr
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {t('nav.yesterday')}
              </button>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Right Actions: Telemetry + Language + Persona Switcher + Notifications */}
          <div className="flex items-center gap-2.5">
            {/* Live SSE Pulse Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/70 text-[11px] font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Realtime Outbox Sync</span>
            </div>

            <LanguageToggle compact />

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDrawer(!showNotifDrawer)}
                className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                title={t('nav.notifications')}
                aria-label={t('nav.notifications')}
                aria-expanded={showNotifDrawer}
              >
                <Bell className="w-5 h-5" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs ring-2 ring-white animate-bounce">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {/* Notification Slideout / Dropdown */}
              {showNotifDrawer && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/90 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">{t('nav.notifications')}</span>
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        {unreadNotifs.length} {t('nav.unread')}
                      </span>
                    </div>
                    <button
                      onClick={() => onMarkNotificationRead('ALL')}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                    >
                      {t('nav.markAllRead')}
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 font-medium">
                        <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        {t('nav.noNotif')}
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => onMarkNotificationRead(n.id)}
                          className={`p-3.5 text-left hover:bg-slate-50 transition cursor-pointer ${
                            !n.read ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
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
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs transition-all text-left group"
              >
                <div className="w-7 h-7 rounded-xl bg-linear-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  {activePersona.name.charAt(0)}
                </div>
                <div className="hidden sm:block leading-tight">
                  <div className="text-xs font-black text-slate-900 group-hover:text-emerald-700 transition">
                    {activePersona.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-35">{activePersona.subtitle}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Persona Switcher Dropdown */}
              {showPersonaMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/90 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3.5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>{t('nav.switchPersona')}</span>
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">Realtime Switch</span>
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
                          className={`w-full text-left p-2.5 rounded-2xl flex items-center justify-between transition ${
                            isSelected
                              ? 'bg-emerald-50/90 text-emerald-950 font-bold border border-emerald-200/80 shadow-2xs'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-xs font-black">{p.name}</div>
                              <div className="text-[11px] text-slate-500">{p.subtitle}</div>
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${p.badgeColor}`}
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
      <div className="border-t border-slate-200/70 bg-slate-50/80 backdrop-blur-md px-4 sm:px-6 lg:px-8">
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
                <span>{t('tab.daily')}</span>
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
                <span>{t('tab.calendar')}</span>
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
                <span>{t('tab.customers')}</span>
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
                <span>{t('tab.billing')}</span>
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
                <span>{t('tab.disputes')}</span>
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
                <span>{t('tab.requests')}</span>
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
                <span>{t('tab.pricing')}</span>
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
                <span>{t('tab.forecast')}</span>
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
                <span>{t('tab.audit')}</span>
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
                <span>{t('tab.routes')}</span>
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
                <span>{t('ctab.home')}</span>
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
                <span>{t('ctab.calendar')}</span>
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
                <span>{t('ctab.billing')}</span>
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
                <span>{t('ctab.vacation')}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="px-3 py-1 text-slate-500 font-medium">
                {t('admin.banner')}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
