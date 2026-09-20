'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Volume2, VolumeX, Users, Truck, FileText, QrCode, Shield, CheckCircle } from 'lucide-react';
import { sound } from '@/lib/sound';
import { vibrateLight } from '@/lib/haptics';

interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
}

export function QuickCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [soundActive, setSoundActive] = useState(() => (typeof window !== 'undefined' ? sound.isEnabled() : true));
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) {
            sound.playClick();
            vibrateLight();
          }
          return !prev;
        });
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const commands: CommandItem[] = useMemo(() => [
    {
      id: 'admin_customers',
      title: 'Farmer Portal: Manage Customers & Subscriptions',
      category: 'Navigation',
      icon: <Users className="w-4 h-4 text-emerald-600" />,
      action: () => router.push('/admin'),
      shortcut: 'G C',
    },
    {
      id: 'admin_deliveries',
      title: 'Farmer Portal: Daily Delivery Dispatch Ledger',
      category: 'Navigation',
      icon: <Truck className="w-4 h-4 text-blue-600" />,
      action: () => router.push('/admin'),
      shortcut: 'G D',
    },
    {
      id: 'admin_billing',
      title: 'Farmer Portal: Invoices & Ledger Billing',
      category: 'Navigation',
      icon: <FileText className="w-4 h-4 text-amber-600" />,
      action: () => router.push('/admin'),
      shortcut: 'G B',
    },
    {
      id: 'customer_portal',
      title: 'Client Portal: View Dashboard & Deliveries',
      category: 'Navigation',
      icon: <CheckCircle className="w-4 h-4 text-purple-600" />,
      action: () => router.push('/customer'),
    },
    {
      id: 'customer_qr',
      title: 'Client QR Code: View Verification Token',
      category: 'Navigation',
      icon: <QrCode className="w-4 h-4 text-indigo-600" />,
      action: () => router.push('/customer/qr'),
    },
    {
      id: 'superadmin_governance',
      title: 'SuperAdmin: Governance & Assurance Audit',
      category: 'Administration',
      icon: <Shield className="w-4 h-4 text-rose-600" />,
      action: () => router.push('/superadmin'),
    },
    {
      id: 'toggle_sound',
      title: soundActive ? 'Mute Audio Chimes' : 'Enable Audio Chimes',
      category: 'Preferences',
      icon: soundActive ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-emerald-600" />,
      action: () => {
        const next = sound.toggleSound();
        setSoundActive(next);
      },
      shortcut: 'Toggle',
    },
  ], [router, soundActive]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase();
    return commands.filter(
      (c) => c.title.toLowerCase().includes(lower) || c.category.toLowerCase().includes(lower)
    );
  }, [commands, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none text-base"
            placeholder="Type a command or jump to page... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close command palette"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No matching commands or actions found for &quot;{query}&quot;
            </div>
          ) : (
            filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => {
                  sound.playClick();
                  cmd.action();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-900 dark:hover:text-emerald-200 text-slate-700 dark:text-slate-300 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition">
                    {cmd.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{cmd.title}</div>
                    <div className="text-xs text-slate-400">{cmd.category}</div>
                  </div>
                </div>
                {cmd.shortcut && (
                  <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Navigate with mouse or keyboard</span>
          <span className="flex items-center gap-1 font-mono">
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              Ctrl+K
            </kbd>{' '}
            or{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              ⌘K
            </kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
