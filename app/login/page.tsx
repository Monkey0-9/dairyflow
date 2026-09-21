'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Droplets,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useT, LanguageToggle } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '';
  const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : null;

  const { t } = useT();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const executeLogin = async (loginIdentifier: string, loginPass: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier.trim(), password: loginPass }),
      });
      const data = await res.json();
      if (data.success) {
        const dest =
          safeRedirect ||
          data.redirectUrl ||
          (data.user?.role === 'CUSTOMER'
            ? '/customer'
            : data.user?.role === 'SUPERADMIN' || data.user?.role === 'ADMIN'
              ? '/superadmin'
              : '/admin');
        router.push(dest);
        router.refresh();
      } else {
        setError(data.error || 'Authentication rejected. Verify your credentials and retry.');
      }
    } catch {
      setError('Connection interrupted. Verify server connectivity and retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Enter your registered email address or mobile number.');
      return;
    }
    if (!password) {
      setError('Enter your account password.');
      return;
    }
    await executeLogin(identifier, password);
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-5 z-10 relative">

        {/* Brand Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center justify-center group focus:outline-none">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 dark:bg-slate-900 flex items-center justify-center border border-slate-800 dark:border-slate-700 group-hover:border-emerald-700 transition-all">
              <Droplets className="w-5 h-5 text-emerald-400" />
            </div>
          </Link>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              MilkFlow
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Private Reserve — Secure Access
            </p>
          </div>

          <div className="flex justify-center">
            <LanguageToggle compact />
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {error && (
            <div className="p-4">
              <ErrorBanner message={error} onDismiss={() => setError('')} />
            </div>
          )}

          {/* Credentials Form — the only sign-in path. No demo accounts. */}
            <form onSubmit={handleCredentialLogin} className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
                >
                  Email or Phone Number
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="user@domain.com or +91 00000 00000"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Show</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:focus:border-emerald-500 transition font-mono"
                />
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={loading}
                  className="w-full"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('login.signIn')}
                </Button>
              </div>
            </form>

          {/* Security Footer */}
          <div className="px-5 py-3 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-1.5">
              <KeyRound className="w-3 h-3" />
              <span>Scrypt · HMAC-SHA256 Session Seals</span>
            </div>
            <span className="font-mono text-[9px] text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
              ISO 29148
            </span>
          </div>
        </div>

        {/* Invitation Token Link */}
        <div className="text-center space-y-1.5">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Have an onboarding invitation token?
          </p>
          <Link
            href="/activate"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline transition"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Redeem Invitation Token</span>
          </Link>
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to MilkFlow</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F17]">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
