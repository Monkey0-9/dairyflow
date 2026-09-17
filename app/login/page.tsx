'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Droplets, ShieldCheck, ArrowRight, UserCheck, Lock, Sparkles, CheckCircle2, Phone } from 'lucide-react';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '';

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const demoUsers = [
    {
      id: 'user_farmer',
      name: 'Suresh Patel (Farmer)',
      role: 'FARMER',
      desc: 'Owner, GreenValley Dairy • Route & Delivery Admin',
      badge: 'Farmer / Seller',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      dest: '/admin',
    },
    {
      id: 'user_ravi',
      name: 'Ravi Kumar',
      role: 'CUSTOMER',
      desc: '1.0 L Cow Milk • Active Subscriber',
      badge: 'Customer',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      dest: '/customer',
    },
    {
      id: 'user_priya',
      name: 'Priya Sharma',
      role: 'CUSTOMER',
      desc: '1.5 L Buffalo Milk • Scheduled Vacation Sep 20-25',
      badge: 'Customer (Vacation)',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      dest: '/customer',
    },
    {
      id: 'user_anand',
      name: 'Anand Verma',
      role: 'CUSTOMER',
      desc: '2.0 L A2 Milk • Has Open Delivery Dispute',
      badge: 'Customer (Dispute)',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      dest: '/customer',
    },
    {
      id: 'user_admin',
      name: 'Platform SuperAdmin',
      role: 'ADMIN',
      desc: 'Multi-Dairy System Oversight & Governance',
      badge: 'SuperAdmin',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      dest: '/superadmin',
    },
  ];

  const handleQuickLogin = async (demoUserId: string, fallbackDest: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoUserId }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(redirect || data.redirectUrl || fallbackDest);
        router.refresh();
      } else {
        setError(data.error || 'Failed to login');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      setError('Please enter your mobile phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(redirect || data.redirectUrl);
        router.refresh();
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 mb-4 animate-bounce">
          <Droplets className="w-9 h-9" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
          <span>Milk</span>
          <span className="text-emerald-400">Flow</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400 font-medium">
          Digital Milk Management & Subscription Billing System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl sm:px-10 text-slate-900 border border-slate-200/40 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Quick Demo Persona Switcher */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Select Persona for Evaluation
              </span>
              <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                1-Tap Direct Auth
              </span>
            </div>

            <div className="space-y-2">
              {demoUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleQuickLogin(user.id, user.dest)}
                  disabled={loading}
                  className="w-full p-3 rounded-2xl border border-slate-200/90 hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-xs transition text-left flex items-center justify-between group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-extrabold text-sm group-hover:bg-emerald-600 group-hover:text-white transition">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                        <span>{user.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${user.badgeColor}`}>
                          {user.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{user.desc}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-xs text-slate-400 font-bold uppercase">Or Login with Phone</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Phone Credentials Form */}
          <form onSubmit={handleCredentialLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Registered Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 98234 56780"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
            </button>
          </form>

          {/* Link to Public Registration */}
          <div className="pt-2 text-center border-t border-slate-100">
            <p className="text-xs text-slate-600">
              New customer wanting daily milk delivery?{' '}
              <Link
                href="/register"
                className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                Register as Customer →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
