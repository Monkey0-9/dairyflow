'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Bell,
  UserCheck,
  ChevronDown,
  Droplets,
  Truck,
  FileText,
  CreditCard,
  Clock,
  User,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { UserRole, Notification } from '@/lib/types';
import { useT, LanguageToggle } from '@/lib/i18n';

interface NavbarProps {
  currentRole: UserRole;
  currentUserId: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  notifications: Notification[];
  onMarkNotificationRead: (id: string) => void;
  disputeCount: number;
  pendingRequestsCount?: number;
}

export default function Navbar({
  currentRole,
  currentUserId,
  selectedDate,
  onDateChange,
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
  const router = useRouter();

  // SRS §21: no demo/persona data in production UI. Identity comes from the
  // authenticated session role only.
  const activePersona = {
    role: currentRole,
    userId: currentUserId,
    name:
      currentRole === 'CUSTOMER'
        ? 'Client Account'
        : currentRole === 'ADMIN' || currentRole === 'SUPERADMIN'
          ? 'Administrator'
          : 'Estate Owner',
    subtitle:
      currentRole === 'CUSTOMER' ? 'Private Allocation' : 'MilkFlow Operations',
    badge: currentRole === 'CUSTOMER' ? 'Client' : currentRole,
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  const unreadNotifs = notifications.filter((n) => !n.read);

  const todayStr = new Date().toISOString().split('T')[0];
  const yDate = new Date();
  yDate.setDate(yDate.getDate() - 1);
  const yesterdayStr = yDate.toISOString().split('T')[0];
  const isToday = selectedDate === todayStr;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl transition-all">
      {/* Primary Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-950 dark:bg-slate-900 flex items-center justify-center border border-slate-800 dark:border-slate-700">
              <Droplets className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  Milk<span className="text-emerald-600 dark:text-emerald-400">Flow</span>
                </span>
                <span className="hidden sm:inline text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                  {t('brand.tag')}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-status-pulse shrink-0" />
                <span>Live</span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span>{t('brand.sub')}</span>
              </div>
            </div>
          </div>

          {/* Center Date Controller (Farmer / Admin only) */}
          {currentRole !== 'CUSTOMER' && (
            <div className="hidden md:flex items-center gap-1 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => onDateChange(todayStr)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isToday
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {t('nav.today')}
              </button>
              <button
                onClick={() => onDateChange(yesterdayStr)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedDate === yesterdayStr
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {t('nav.yesterday')}
              </button>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <LanguageToggle compact />

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDrawer(!showNotifDrawer)}
                className="relative p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={t('nav.notifications')}
                aria-label={t('nav.notifications')}
                aria-expanded={showNotifDrawer}
                id="notification-bell"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white dark:ring-slate-950">
                    {unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}
                  </span>
                )}
              </button>

              {/* Notification Panel */}
              {showNotifDrawer && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-dropdown dark:bg-slate-900/97 dark:border-slate-800 rounded-2xl py-2 z-50">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{t('nav.notifications')}</span>
                      {unreadNotifs.length > 0 && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-semibold border border-slate-200 dark:border-slate-700">
                          {unreadNotifs.length} unread
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onMarkNotificationRead('ALL')}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold transition"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                        <Bell className="w-6 h-6 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                        {t('nav.noNotif')}
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => onMarkNotificationRead(n.id)}
                          className={`px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer ${
                            !n.read ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            {!n.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                            )}
                            <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex-1">{n.title}</h4>
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Account Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left"
                id="account-switcher"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
                  {activePersona.name.charAt(0)}
                </div>
                <div className="hidden sm:block leading-tight">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {activePersona.name}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-30">{activePersona.subtitle}</div>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              </button>

              {/* Account Dropdown */}
              {showPersonaMenu && (
                <div className="absolute right-0 mt-2 w-72 glass-dropdown dark:bg-slate-900/97 dark:border-slate-800 rounded-2xl p-2 z-50 space-y-1">
                  {/* Current Account Header */}
                  <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-sm">
                      {activePersona.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{activePersona.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">{currentRole}</div>
                    </div>
                  </div>

                  {/* Navigation Actions */}
                  <div className="space-y-0.5 pt-0.5">
                    {(currentRole === 'FARMER' || currentRole === 'ADMIN') && (
                      <Link
                        href="/admin/profile"
                        onClick={() => setShowPersonaMenu(false)}
                        className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-2"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Account Profile</span>
                        <ChevronRight className="w-3 h-3 ml-auto text-slate-400" />
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/auth/logout', { method: 'POST' });
                        router.push('/login');
                        router.refresh();
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Tab Navigation */}
      <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur-sm px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center overflow-x-auto py-1.5 gap-0.5 text-xs font-medium scrollbar-none">
          {currentRole === 'FARMER' ? (
            <div className="flex items-center gap-0.5">
              {[
                { key: 'daily', label: t('nav.today') + ' Run', icon: <Truck className="w-3.5 h-3.5" /> },
                { key: 'calendar', label: 'Calendar', icon: <Calendar className="w-3.5 h-3.5" /> },
                { key: 'customers', label: 'Clients', icon: <UserCheck className="w-3.5 h-3.5" /> },
                { key: 'billing', label: 'Billing', icon: <FileText className="w-3.5 h-3.5" /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}

              <button
                onClick={() => onTabChange('requests')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition relative cursor-pointer whitespace-nowrap ${
                  activeTab === 'requests'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Requests</span>
                {pendingRequestsCount !== undefined && pendingRequestsCount > 0 && (
                  <span className="ml-0.5 min-w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onTabChange('more')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition relative cursor-pointer whitespace-nowrap ${
                  ['more', 'pricing', 'forecast', 'audit', 'routes', 'disputes', 'ops', 'inventory'].includes(activeTab)
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>More</span>
                {disputeCount > 0 && (
                  <span className="ml-0.5 min-w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {disputeCount}
                  </span>
                )}
              </button>
            </div>
          ) : currentRole === 'CUSTOMER' ? (
            <div className="flex items-center gap-0.5">
              {[
                { key: 'customer_home', label: t('ctab.home'), icon: <Droplets className="w-3.5 h-3.5" /> },
                { key: 'customer_calendar', label: t('ctab.calendar'), icon: <Calendar className="w-3.5 h-3.5" /> },
                { key: 'customer_billing', label: t('ctab.billing'), icon: <CreditCard className="w-3.5 h-3.5" /> },
                { key: 'customer_vacation', label: t('ctab.vacation'), icon: <Calendar className="w-3.5 h-3.5" /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <span className="px-3 py-1.5 text-slate-400 dark:text-slate-500 text-xs font-medium">
                {t('admin.banner')}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
