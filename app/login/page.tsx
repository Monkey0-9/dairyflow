'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Droplets, ArrowLeft, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import { useT, LanguageToggle } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '';
  // Prevent open redirect attacks by ensuring redirect is a relative path
  const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : null;

  const { t } = useT();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your registered email address or mobile phone number.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await res.json();
      if (data.success) {
        const dest = safeRedirect || data.redirectUrl || (data.user?.role === 'CUSTOMER' ? '/customer' : (data.user?.role === 'SUPERADMIN' ? '/superadmin' : '/admin'));
        router.push(dest);
        router.refresh();
      } else {
        // Generic error message to prevent user enumeration
        setError(data.error || 'Invalid credentials. Please verify your credentials and try again.');
      }
    } catch {
      setError('Connection interrupted. Please verify your network and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-amber-500 selection:text-slate-950 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        {/* Top Header & Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 dark:bg-slate-900 flex items-center justify-center text-amber-400 border border-amber-500/30 shadow-xs group-hover:border-amber-400 transition">
              <Droplets className="w-6 h-6 text-amber-400" />
            </div>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Private Reserve Protocol</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            Private Client &amp; Estate Sign In
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-normal">
            Authenticate to access your private ledger and distribution schedule.
          </p>
          <div className="mt-3 flex justify-center">
            <LanguageToggle compact />
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-950 py-8 px-6 sm:px-10 shadow-sm rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-6">
          {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

          <form onSubmit={handleCredentialLogin} className="space-y-4">
            <Input
              label="Registered Email or Mobile Phone"
              id="login-identifier"
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. client@estate.in or +91 98765 43210"
              helperText="Associated with your private client invitation token"
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white/20 transition"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={loading}
                className="w-full"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('login.signIn')}
              </Button>
            </div>
          </form>

          {/* Passkey / Hardware Security Hint */}
          <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 text-[11px] text-slate-500">
            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
            <span>FIDO2 Passkeys &amp; Scrypt Authenticated</span>
          </div>

          {/* Invitation Activation Link */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center space-y-2">
            <p className="text-xs text-slate-500 font-medium">
              Have an onboarding invitation code?
            </p>
            <Link
              href="/activate"
              className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Redeem Invitation Token</span>
            </Link>
          </div>
        </div>

        {/* Back to Home Link */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Private Reserve Home</span>
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
        <div className="min-h-screen flex items-center justify-center bg-[#FBFBFC] dark:bg-[#0B0F17]">
          <div className="text-xs font-mono text-slate-400">Loading secure authentication...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
